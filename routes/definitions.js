// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')
const logger = require('../providers/logging/logger')

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

// Gets the definition for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getDefinition))
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getDefinition))

// When a request for a component with slashes in the namespace comes in
// They are initially encoded with url encoding like this go/golang/github.com%2fgorilla/mux/v1.7.3
// However, when it comes through a load balancer, the load balancer sometimes decodes the encoding to
// go/golang/github.com/gorilla/mux/v1.7.3
// which causes routing errors unless we allow for additional fields
// We currently allow up to three extra fields (that means up to three slashes in the namespace)
router.get('/:type/:provider/:namespace/:name/:revision{/:extra1}{/:extra2}{/:extra3}', asyncMiddleware(getDefinition))

/**
 * @param {Request} request
 * @param {Response} response
 */
async function getDefinition(request, response) {
  const log = logger()
  log.info('getDefinition route hit', { ts: new Date().toISOString(), requestParams: request.params })

  let coordinates

  // Painful way of handling go namespaces with multiple slashes
  // Unfortunately, it seems the best option without doing a massive
  // rearchitecture of the entire coordinate system
  if (request.params.type === 'go' && request.params.provider === 'golang') {
    let namespaceNameRevision = utils.parseNamespaceNameRevision(request)
    let splitString = namespaceNameRevision.split('/')

    // Pull off the last part of the string as the revision
    const revision = splitString.pop()

    // Pull of next part of the string as the name
    const name = splitString.pop()

    // Join the rest of the string as the namespace
    const nameSpace = splitString.join('/')

    coordinates = utils.toEntityCoordinatesFromArgs({
      type: request.params.type,
      provider: request.params.provider,
      namespace: nameSpace,
      name: name,
      revision: revision
    })
  } else {
    coordinates = await utils.toEntityCoordinatesFromRequest(request)
  }

  const pr = request.params.pr
  const force = request.query.force
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  log.debug('get_definition:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
  const result = await definitionService.get(coordinates, pr, force, expand)
  log.debug('get_definition:prepared', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
  response.status(200).send(result)
  log.debug('get_definition:sent', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
  return
}

// Get a list of autocomplete suggestions of components for which we have any kind of definition.
// and match the given query
router.get('/', asyncMiddleware(getDefinitions))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getDefinitions(request, response) {
  // TODO temporary endpoint to trigger reloading the index or definitions
  if (request.query.reload) {
    // TODO purposely do not await this call. This is a fire and forget long running operation for now.
    reload(request, response)
    return response.sendStatus(200)
  }
  const pattern = request.query.pattern
  if (pattern) return response.send(await definitionService.suggestCoordinates(pattern))
  if (!validator.validate('definitions-find', request.query)) return response.status(400).send(validator.errorsText())
  const normalizedCoordinates = await utils.toNormalizedEntityCoordinates(request.query)
  const result = await definitionService.find({ ...request.query, ...normalizedCoordinates })
  return response.send(result)
}

// TODO temporary method used to trigger the reloading of the search index
/**
 * @param {Request} request
 * @param {Response} response
 */
async function reload(request, response) {
  await definitionService.reload(request.query.reload)
  response.status(200).end()
}

// Previews the definition for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
router.post(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (/** @type {Request} */ request, /** @type {Response} */ response) => {
    if (!request.query.preview)
      return response.status(400).send('Only valid for previews. Use the "preview" query parameter')
    if (!validator.validate('curation', request.body)) return response.status(400).send(validator.errorsText())
    const coordinates = await utils.toEntityCoordinatesFromRequest(request)
    const result = await definitionService.compute(coordinates, request.body)
    return response.status(200).send(result)
  })
)

// POST a request to create a resource that is the list of definitions available for
// the components outlined in the POST body
router.post('/', asyncMiddleware(listDefinitions))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function listDefinitions(request, response) {
  const log = logger()
  const coordinatesList = request.body.map((/** @type {any} */ entry) => EntityCoordinates.fromString(entry))
  if (coordinatesList.length > 500)
    return response.status(400).send(`Body contains too many coordinates: ${coordinatesList.length}`)
  const normalizedCoordinates = await Promise.all(coordinatesList.map(utils.toNormalizedEntityCoordinates))
  const coordinatesLookup = mapCoordinates(request, normalizedCoordinates)

  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  try {
    // Temporarily adding this verbose logging to find perf issues
    log.debug('POSTing to /definitions', {
      ts: new Date().toISOString(),
      requestParams: request.params,
      normalizedCoordinates,
      coordinateCount: Array.isArray(normalizedCoordinates) ? normalizedCoordinates.length : 0,
      force,
      expand,
      userAgent: request.get('User-Agent')
    })
    let result = await definitionService.getAll(normalizedCoordinates, force, expand)

    const matchCasing = !(request.query.matchCasing === 'false')
    // enforce request casing on keys as per issue #589
    result = adaptResultKeys(result, request.body, coordinatesLookup, matchCasing)
    return response.send(result)
  } catch (err) {
    const error = /** @type {Error} */ (err)
    return response.send(
      `An error occurred when trying to fetch coordinates for one of the components: ${error.message}`
    )
  }
}

/**
 * @param {Request} request
 * @param {any[]} normalizedCoordinates
 */
function mapCoordinates(request, normalizedCoordinates) {
  const coordinatesLookup = new Map()
  if (!Array.isArray(request.body) || !request.body.every(item => typeof item === 'string')) {
    return coordinatesLookup // or throw new Error("Invalid input format")
  }

  for (let i = 0; i < request.body.length; i++) {
    const requestedKey = request.body[i]
    const normalizedKey = normalizedCoordinates[i]?.toString()
    if (requestedKey && normalizedKey && requestedKey.toLowerCase() !== normalizedKey.toLowerCase())
      coordinatesLookup.set(requestedKey, normalizedKey)
  }
  return coordinatesLookup
}

/**
 * @param {Record<string, any>} result
 * @param {string[]} requestedKeys
 * @param {Map<string, string>} coordinatesLookup
 * @param {boolean} matchCase
 */
function adaptResultKeys(result, requestedKeys, coordinatesLookup, matchCase) {
  const shouldAdaptKeys = coordinatesLookup.size > 0 || matchCase
  if (!shouldAdaptKeys) return result
  const resultKeyLookup = new Map(Object.keys(result).map(key => [key.toLowerCase(), key]))
  return requestedKeys.reduce((total, requested) => {
    let mapped = coordinatesLookup.get(requested)
    if (matchCase) mapped = mapped || resultKeyLookup.get(requested.toLowerCase())
    const resultKey = mapped || resultKeyLookup.get(requested.toLowerCase())
    const value = result[resultKey]
    if (value) total[mapped ? requested : resultKey] = value
    return total
  }, /** @type {Record<string, any>} */ ({}))
}

/** @type {any} */
let definitionService

/**
 * @param {any} definition
 * @param {boolean} [testFlag]
 */
function setup(definition, testFlag = false) {
  definitionService = definition

  if (testFlag) {
    const _router = /** @type {any} */ (router)
    _router._getDefinition = getDefinition
    _router._adaptResultKeys = adaptResultKeys
  }
  return router
}

module.exports = setup
