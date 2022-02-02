// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')

// Get some suggestions for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getSuggestions))
async function getSuggestions(request, response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await suggestionService.get(coordinates)
  if (result) return response.status(200).send(result)
  response.sendStatus(404)
}

let suggestionService

function setup(service) {
  suggestionService = service
  return router
}

module.exports = setup
