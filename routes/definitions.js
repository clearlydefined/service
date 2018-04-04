// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const _ = require('lodash')
const EntityCoordinates = require('../lib/entityCoordinates')
const DefinitionsCache = require('../business/definitionsCache')

// Gets the definition for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getDefinition))
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getDefinition))

async function getDefinition(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const pr = request.params.pr
  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false
  const result = await definitionService.get(coordinates, pr, force)
  response.status(200).send(result)
}

// Get a list of autocomplete suggestions of components for which we have any kind of definition.
router.get('/suggestions', asyncMiddleware(getDefinitionSuggestions))
async function getDefinitionSuggestions(request, response) {
  const type = request.query.type || 'coordinates'
  const pattern = request.query.pattern
  switch (type) {
    case 'coordinates':
      return response.send(await definitionService.suggestCoordinates(pattern))
    case 'copyright':
      return response.send(definitionService.suggestCopyright(pattern))
    default:
      throw new Error(`Invalid search type: ${type}`)
  }
}

// Get a list of the components for which we have any kind of definition.
router.get(
  '/:type?/:provider?/:namespace?/:name?',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    const cachedDefinitions = await DefinitionsCache.get(coordinates)
    if (cachedDefinitions) return response.send(cachedDefinitions)
    const curated = await curationService.list(coordinates)
    const harvest = await harvestService.list(coordinates)
    const stringHarvest = harvest.map(c => c.toString())
    const result = _.union(stringHarvest, curated)
    DefinitionsCache.set(coordinates, result)
    response.send(result)
  })
)

// Previews the definition for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
router.post(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (request, response) => {
    if (!request.query.preview) return response.sendStatus(400)
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    const result = await definitionService.compute(coordinates, request.body)
    response.status(200).send(result)
  })
)

// POST a request to create a resource that is the list of definitions available for
// the components outlined in the POST body
router.post(
  '/',
  asyncMiddleware(async (request, response) => {
    const coordinatesList = request.body.map(entry => EntityCoordinates.fromString(entry))
    // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
    const force = request.hostname.includes('localhost') ? request.query.force || false : false
    const result = await definitionService.getAll(coordinatesList, force)
    response.status(200).send(result)
  })
)

let harvestService
let curationService
let definitionService

function setup(harvest, curation, definition) {
  harvestService = harvest
  curationService = curation
  definitionService = definition
  return router
}
module.exports = setup
