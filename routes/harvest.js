// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const minimatch = require('minimatch')
const utils = require('../lib/utils')
const bodyParser = require('body-parser')
const { permissionsCheck } = require('../middleware/permissions')
const validator = require('../schemas/validator')

// Gets a given harvested file
router.get('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion', asyncMiddleware(get))

async function get(request, response) {
  const coordinates = utils.toResultCoordinatesFromRequest(request)
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.get(coordinates, response)
      // some harvest services will stream on the response and trigger sending
      return response.headersSent ? null : response.status(200).send(result)
    }
    case 'summary': {
      const raw = await harvestStore.get(coordinates)
      const filter = await getFilter(coordinates)
      const result = await summarizeService.summarize(coordinates, filter, raw)
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

async function getFilter(coordinates) {
  try {
    const descriptionCoordinates = { ...coordinates, tool: 'clearlydefined' }
    const rawDescription = await harvestStore.get(descriptionCoordinates)
    return buildFilter(rawDescription.facets)
  } catch (error) {
    return null
  }
}

function buildFilter(facets) {
  if (!facets) return null
  const list = [...facets.test, ...facets.dev, ...facets.data]
  return file => !list.some(filter => minimatch(file, filter))
}

// Gets ALL the harvested data for a given component revision
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getAll))

async function getAll(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.getAll(coordinates)
      return response.status(200).send(result)
    }
    case 'summary': {
      const raw = await harvestStore.getAll(coordinates)
      const filter = await getFilter(coordinates)
      const summarized = await summarizeService.summarizeAll(coordinates, raw, filter)
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
router.get('/:type?/:provider?/:namespace?/:name?/:revision?/:tool?', asyncMiddleware(list))

async function list(request, response) {
  const coordinates = utils.toResultCoordinatesFromRequest(request)
  const result = await harvestStore.list(coordinates)
  return response.status(200).send(result)
}

// Post a (set of) component to be harvested
router.post('/', permissionsCheck('harvest'), bodyParser.json(), asyncMiddleware(queue))

async function queue(request, response) {
  const requests = Array.isArray(request.body) ? request.body : [request.body]
  if (!validator.validate('harvest', requests)) return response.status(400).send(validator.errorsText())
  await harvestService.harvest(request.body)
  response.sendStatus(201)
}

let harvestService
let harvestStore
let summarizeService

function setup(harvester, store, summarizer, testFlag = false) {
  harvestService = harvester
  harvestStore = store
  summarizeService = summarizer
  if (testFlag) router._queue = queue
  return router
}

module.exports = setup
