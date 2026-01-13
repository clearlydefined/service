// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const utils = require('../lib/utils')
const bodyParser = require('body-parser')
const validator = require('../schemas/validator')
const EntityCoordinates = require('../lib/entityCoordinates')

// Gets a given harvested file
router.get('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion', asyncMiddleware(get))

async function get(request, response) {
  const coordinates = await utils.toResultCoordinatesFromRequest(request)
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.get(coordinates, response)
      // some harvest services will stream on the response and trigger sending
      return response.headersSent ? null : response.status(200).send(result)
    }
    case 'summary': {
      const raw = await harvestStore.get(coordinates)
      const rawFromTool = raw && {
        [coordinates.tool]: {
          [coordinates.toolVersion]: raw
        }
      }
      const resultFromTool = await summarizeService.summarizeAll(coordinates, rawFromTool)
      const result = (resultFromTool[coordinates.tool] || {})[coordinates.toolVersion]
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

async function getAll(request, response) {
  const coordinates = await utils.toEntityCoordinatesFromRequest(request)
  switch ((request.query.form || 'summary').toLowerCase()) {
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

async function list(request, response) {
  const coordinates = await utils.toResultCoordinatesFromRequest(request)
  const result = await harvestStore.list(coordinates)
  return response.status(200).send(result)
}

// Post a (set of) component to be harvested
router.post('/', bodyParser.json({ limit: '1mb' }), asyncMiddleware(queue))

async function queue(request, response) {
  const requests = Array.isArray(request.body) ? request.body : [request.body]

  if (requests.length > 1000) {
    return response.status(400).send({ error: 'Too many coordinates', count: requests.length })
  }

  if (!validator.validate('harvest', requests)) {
    return response.status(400).send({ error: 'Validation failed', details: validator.errors })
  }

  let normalized
  try {
    normalized = await normalizeFilterCoordinates(requests)
  } catch (error) {
    return response.status(422).send({ error: error.message })
  }

  await harvestService.harvest(normalized, request.query.turbo)
  response.sendStatus(201)
}

async function normalizeFilterCoordinates(requests) {
  const normalizedBody = await Promise.all(
    requests.map(async entry => {
      const coordinates = EntityCoordinates.fromString(entry?.coordinates)
      if (!coordinates) return null
      const normalized = await utils.toNormalizedEntityCoordinates(coordinates)
      if (harvestThrottler.isBlocked(normalized)) throw new Error(`Harvest throttled for ${normalized.toString()}`)
      return { ...entry, coordinates: normalized.toString() }
    })
  )
  return normalizedBody.filter(entry => entry && entry.coordinates)
}

let harvestService
let harvestStore
let summarizeService
let harvestThrottler

function setup(harvester, store, summarizer, throttler, testFlag = false) {
  harvestService = harvester
  harvestStore = store
  summarizeService = summarizer
  harvestThrottler = throttler
  if (testFlag) {
    router._queue = queue
    router._get = get
    router._normalizeCoordinates = normalizeFilterCoordinates
  }
  return router
}

module.exports = setup
