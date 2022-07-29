// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')
const logger = require('../providers/logging/logger')

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
router.get('/:type/:provider/:namespace/:name/:revision/:extra1?/:extra2?/:extra3?', asyncMiddleware(getDefinition))

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

    coordinates = utils.toEntityCoordinatesFromArgs(
      {
        'type': request.params.type,
        'provider': request.params.provider,
        'namespace': nameSpace,
        'name': name,
        'revision': revision
      }
    )
  } else {
    coordinates = await utils.toEntityCoordinatesFromRequest(request)
  }

  const pr = request.params.pr
  const force = request.query.force
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  log.info('get_definition:start', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
  const result = await definitionService.get(coordinates, pr, force, expand)
  log.info('get_definition:prepared', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
  response.status(200).send(result)
  log.info('get_definition:sent', { ts: new Date().toISOString(), coordinates: coordinates.toString() })
}

// Get a list of autocomplete suggestions of components for which we have any kind of definition.
// and match the given query
router.get('', asyncMiddleware(getDefinitions))
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
  response.send(result)
}

// TODO temporary method used to trigger the reloading of the search index
async function reload(request, response) {
  await definitionService.reload(request.query.reload)
  response.status(200).end()
}

// Previews the definition for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
router.post(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (request, response) => {
    if (!request.query.preview)
      return response.status(400).send('Only valid for previews. Use the "preview" query parameter')
    if (!validator.validate('curation', request.body)) return response.status(400).send(validator.errorsText())
    const coordinates = await utils.toEntityCoordinatesFromRequest(request)
    const result = await definitionService.compute(coordinates, request.body)
    response.status(200).send(result)
  })
)

// POST a request to create a resource that is the list of definitions available for
// the components outlined in the POST body
router.post('/', asyncMiddleware(listDefinitions))
async function listDefinitions(request, response) {
  const coordinatesList = request.body.map(entry => EntityCoordinates.fromString(entry))
  if (coordinatesList.length > 500)
    return response.status(400).send(`Body contains too many coordinates: ${coordinatesList.length}`)
  const normalizedCoordinates = await Promise.all(coordinatesList.map(utils.toNormalizedEntityCoordinates))
  const coordinatesLookup = mapCoordinates(request, normalizedCoordinates)

  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  try {
    // Tempoarily adding this verbose logging to find perf issues
    log.info('POSTing to /definitions', {
        ts: new Date().toISOString(), requestParams: request.params,
        normalizedCoordinates,
        coordinateCount: coordinatesList.length,
        force,
        expand,
        userAgent: request.get('User-Agent')
    })
    let result = await definitionService.getAll(normalizedCoordinates, force, expand)

    const matchCasing = !(request.query.matchCasing === 'false' || request.query.matchCasing === false)
    // enforce request casing on keys as per issue #589
    result = adaptResultKeys(result, request.body, coordinatesLookup, matchCasing)
    response.send(result)
  } catch (err) {
    response.send(`An error occurred when trying to fetch coordinates for one of the components: ${err.message}`)
  }
}

function mapCoordinates(request, normalizedCoordinates) {
  const coordinatesLookup = new Map()
  for (let i = 0; i < request.body.length; i++) {
    const requestedKey = request.body[i]
    const normalizedKey = normalizedCoordinates[i]?.toString()
    if (requestedKey && normalizedKey && requestedKey.toLowerCase() !== normalizedKey.toLowerCase())
      coordinatesLookup.set(requestedKey, normalizedKey)
  }
  return coordinatesLookup
}

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
  }, {})
}

let definitionService

function setup(definition, testFlag = false) {
  definitionService = definition

  if (testFlag) {
    router._getDefinition = getDefinition
    router._adaptResultKeys = adaptResultKeys
  }
  return router
}

module.exports = setup
