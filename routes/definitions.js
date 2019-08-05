// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')

// Gets the definition for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getDefinition))
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getDefinition))

async function getDefinition(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const pr = request.params.pr
  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  const result = await definitionService.get(coordinates, pr, force, expand)
  response.status(200).send(result)
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
  const result = await definitionService.find(request.query)
  response.send(result)
}

// TODO temporary method used to trigger the reloading of the search index
async function reload(request, response) {
  await definitionService.reload(request.query.reload)
  response.status(200).end()
}

// Previews the definition for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
async function previewCuration(request, response) {
  if (!request.query.preview)
    return response.status(400).send('Only valid for previews. Use the "preview" query parameter')
  if (!validator.validate('curation', request.body)) return response.status(400).send(validator.errorsText())
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const result = await definitionService.compute(coordinates, request.body)
  response.status(200).send(result)
}
router.post(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(previewCuration)
)

// POST a request to create a resource that is the list of definitions available for
// the components outlined in the POST body
router.post('/', asyncMiddleware(listDefinitions))
async function listDefinitions(request, response) {
  const coordinatesList = request.body.map(entry => EntityCoordinates.fromString(entry))
  if (coordinatesList.length > 1000)
    return response.status(400).send(`Body contains too many coordinates: ${coordinatesList.length}`)
  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false
  const expand = request.query.expand === '-files' ? '-files' : null // only support '-files' for now
  const result = await definitionService.getAll(coordinatesList, force, expand)
  // enforce request casing on keys as per issue #589
  const requestLowered = request.body.map(k => k.toLowerCase())
  const casingEnforced = Object.keys(result).reduce(
    (total, resultKey) => {
      const idx = requestLowered.indexOf(resultKey.toLowerCase())
      const key = idx >= 0 ? request.body[idx] : resultKey
      total[key] = result[resultKey]
      return total
    }, {})
  response.send(casingEnforced)
}

let definitionService

function setup(definition, forTest) {
  definitionService = definition
  return forTest
    ? { listDefinitions, getDefinitions, previewCuration }
    : router
}
module.exports = setup
