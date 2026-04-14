// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import express from 'express'
import type { SuggestionService } from '../business/suggestionService.ts'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import * as utils from '../lib/utils.ts'

// Get some suggestions for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getSuggestions))

async function getSuggestions(request: Request, response: Response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await suggestionService.get(coordinates)
  if (result) {
    return response.status(200).send(result)
  }
  return response.sendStatus(404)
}

let suggestionService: SuggestionService

function setup(service: SuggestionService): Router {
  suggestionService = service
  return router
}

export default setup
