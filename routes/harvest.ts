// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response } from 'express'

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import bodyParser from 'body-parser'
import EntityCoordinates from '../lib/entityCoordinates.ts'
import * as utils from '../lib/utils.ts'
import validator from '../schemas/validator.ts'

// Gets a given harvested file
router.get('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion', asyncMiddleware(get))

async function get(request: Request, response: Response) {
  const coordinates = await utils.toResultCoordinatesFromRequest(request)
  switch ((request.query.form as string || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.get(coordinates, response)
      // some harvest services will stream on the response and trigger sending
      return response.headersSent ? null : response.status(200).send(result)
    }
    case 'summary': {
      const raw = await harvestStore.get(coordinates)
      const rawFromTool = raw && {
        [coordinates.tool!]: {
          [coordinates.toolVersion!]: raw
        }
      }
      const resultFromTool = await summarizeService.summarizeAll(coordinates, rawFromTool)
      const result = resultFromTool[coordinates.tool!]?.[coordinates.toolVersion!]
      return response.status(200).send(result)
    }
    case 'list': {
      const result = await harvestStore.list(coordinates)
      return response.status(200).send(result)
    }
    default:
      throw new Error(`Invalid request form: ${request.query.form}`)
  }
}

// Gets ALL the harvested data for a given component revision
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getAll))

async function getAll(request: Request, response: Response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  switch ((request.query.form as string || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.getAll(coordinates)
      return response.status(200).send(result)
    }
    case 'summary': {
      const raw = await harvestStore.getAll(coordinates)
      const summarized = await summarizeService.summarizeAll(coordinates, raw)
      return response.status(200).send(summarized)
    }
    case 'list': {
      const list = await harvestStore.list(coordinates)
      return response.status(200).send(list)
    }
    default:
      throw new Error(`Invalid request form: ${request.query.form}`)
  }
}

// Get a list of the harvested data that we have that matches the url as a prefix
router.get('{/:type}{/:provider}{/:namespace}{/:name}{/:revision}{/:tool}', asyncMiddleware(list))

async function list(request: Request, response: Response) {
  const coordinates = await utils.toResultCoordinatesFromRequest(request)
  const result = await harvestStore.list(coordinates)
  return response.status(200).send(result)
}

// Post a (set of) component to be harvested
router.post('/', bodyParser.json({ limit: '1mb' }), asyncMiddleware(queue))

async function queue(request: Request, response: Response) {
  const requests = Array.isArray(request.body) ? request.body : [request.body]

  if (requests.length > 1000) {
    return response.status(400).send({ error: 'Too many coordinates', count: requests.length })
  }

  if (!validator.validate('harvest', requests)) {
    return response.status(400).send({ error: 'Validation failed', details: validator.errors })
  }

  let normalizedBody
  try {
    normalizedBody = await normalizeFilterCoordinates(requests)
  } catch (error) {
    const err = error as Error
    return response.status(422).send({ error: err.message })
  }

  await harvestService.harvest(normalizedBody, request.query.turbo)
  return response.sendStatus(201)
}

async function normalizeFilterCoordinates(requests: any[]) {
  const normalizedBody = await Promise.all(
    requests.map(async entry => {
      const coordinates = EntityCoordinates.fromString(entry?.coordinates)
      if (!coordinates) {
        return null
      }
      const normalized = await utils.toNormalizedEntityCoordinates(coordinates)
      if (harvestThrottler.isBlocked(normalized)) {
        throw new Error(`Harvest throttled for ${normalized.toString()}`)
      }
      return { ...entry, coordinates: normalized.toString() }
    })
  )
  return normalizedBody.filter(entry => entry?.coordinates)
}

let harvestService: any
let harvestStore: any
let summarizeService: any
let harvestThrottler: any

function setup(harvester: any, store: any, summarizer: any, throttler: any, testFlag: boolean = false): import('express').Router {
  harvestService = harvester
  harvestStore = store
  summarizeService = summarizer
  harvestThrottler = throttler
  if (testFlag) {
    const _router = router as any
    _router._queue = queue
    _router._get = get
    _router._normalizeCoordinates = normalizeFilterCoordinates
  }
  return router
}

export default setup
