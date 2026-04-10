// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../business/suggestionService').SuggestionService} SuggestionService */

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.js'

const router = express.Router()

import * as utils from '../lib/utils.ts'

// Get some suggestions for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getSuggestions))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getSuggestions(request, response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await suggestionService.get(coordinates)
  if (result) {
    return response.status(200).send(result)
  }
  return response.sendStatus(404)
}

/** @type {SuggestionService} */
let suggestionService

/**
 * @param {SuggestionService} service
 */
function setup(service) {
  suggestionService = service
  return router
}

export default setup
