// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response } from 'express'
import express from 'express'
import type { CurationData, CurationError } from '../lib/curation.ts'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'
import type { Logger } from '../providers/logging/index.js'
import loggerFactory from '../providers/logging/logger.ts'

const router = express.Router()

import Curation from '../lib/curation.ts'
import EntityCoordinates from '../lib/entityCoordinates.ts'
import * as utils from '../lib/utils.ts'
import { permissionsCheck } from '../middleware/permissions.ts'

// Get a proposed patch for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getChangesForCoordinatesInPr))

async function getChangesForCoordinatesInPr(request: Request, response: Response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.get(coordinates, request.params.pr)
  if (result) {
    return response.status(200).send(result)
  }
  return response.sendStatus(404)
}

// Get data needed by review UI
router.get('/pr/:pr', asyncMiddleware(getPr))

async function getPr(request: Request, response: Response) {
  try {
    const url = curationService.getCurationUrl(request.params.pr)
    const changes = await curationService.getChangedDefinitions(request.params.pr)
    return response.status(200).send({ url, changes })
  } catch (exception) {
    const error = exception as Error & { code?: number }
    if (error.code === 404) {
      return response.sendStatus(404)
    }
    throw error
  }
}

// Get an existing patch for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getCurationForCoordinates))

async function getCurationForCoordinates(request: Request, response: Response) {
  if (request.query.expand === 'prs') {
    return listCurations(request, response)
  }
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.get(coordinates)
  if (!result) {
    return response.sendStatus(404)
  }
  return response.status(200).send(result)
}

// Search for any patches related to the given path, as much as is given
router.get('{/:type}{/:provider}{/:namespace}{/:name}', asyncMiddleware(listCurations))

async function listCurations(request: Request, response: Response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.list(coordinates)
  if (!result?.contributions.length) {
    return response.sendStatus(404)
  }
  return response.status(200).send(result)
}

router.post('/', asyncMiddleware(listAllCurations))

async function listAllCurations(request: Request, response: Response) {
  const coordinatesList = request.body.map((entry: string | null | undefined) => EntityCoordinates.fromString(entry))
  if (coordinatesList.length > 1000) {
    return response.status(400).send(`Body contains too many coordinates: ${coordinatesList.length}`)
  }
  const normalizedCoordinatesList = await Promise.all(coordinatesList.map(utils.toNormalizedEntityCoordinates))

  const result = await curationService.listAll(normalizedCoordinatesList)
  return response.send(result)
}

router.patch('', asyncMiddleware(updateCurations))

async function updateCurations(request: Request, response: Response) {
  const serviceGithub = request.app.locals.service.github.client
  const userGithub = request.app.locals.user.github.client
  const info = await request.app.locals.user.github.getInfo!()
  let curationErrors: CurationError[][] = []
  const patchesInError: any[] = []
  for (const entry of request.body.patches as (string | CurationData)[]) {
    const curation = new Curation(entry)
    if (curation.errors.length > 0) {
      curationErrors = [...curationErrors, curation.errors]
    }
    patchesInError.push(entry)
  }
  if (curationErrors.length > 0) {
    const errorData = { errors: curationErrors, patchesInError }
    logger.error('intended curations are invalid', errorData)
    return response.status(400).send(errorData)
  }

  const normalizedPatches = await Promise.all(
    request.body.patches.map(async (entry: CurationData) => {
      return { ...entry, coordinates: await utils.toNormalizedEntityCoordinates(entry.coordinates!) }
    })
  )
  const normalizedBody = { ...request.body, patches: normalizedPatches }

  const result = await curationService.addOrUpdate(userGithub, serviceGithub, info, normalizedBody)
  return response.status(200).send({
    prNumber: result.data.number,
    url: curationService.getCurationUrl(result.data.number)
  })
}

router.post('/sync', permissionsCheck('curate'), asyncMiddleware(syncAllContributions))

async function syncAllContributions(request: Request, response: Response) {
  const userGithub = request.app.locals.user.github.client
  if (!userGithub) {
    return response.status(400).send('Invalid Github user')
  }

  await curationService.syncAllContributions(userGithub)
  return response.send({ status: 'OK' })
}

router.post('/reprocess', permissionsCheck('curate'), asyncMiddleware(reprocessMergedCurations))

async function reprocessMergedCurations(request: Request, respond: Response) {
  const coordinatesArray = request.body.map(EntityCoordinates.fromString)
  // Reprocess consume a lot of resource. Limit the size of the reprocess request.
  const reprocessThreshold = 100
  if (coordinatesArray.length >= reprocessThreshold) {
    return respond.status(403).send({ message: `Reprocess coordinates number exceed ${reprocessThreshold} threshold.` })
  }
  const normalizedCoordinatesList = await Promise.all(coordinatesArray.map(utils.toNormalizedEntityCoordinates))
  const result = await curationService.reprocessMergedCurations(normalizedCoordinatesList)
  return respond.status(200).send(result)
}

let curationService: any
let logger: Logger

function setup(service: any, appLogger?: Logger): import('express').Router {
  curationService = service
  logger = appLogger || loggerFactory()
  return router
}

export default setup
