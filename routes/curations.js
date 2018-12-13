// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const Curation = require('../lib/curation')
const { permissionsCheck } = require('../middleware/permissions')

// Get a proposed patch for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getChangesForCoordinatesInPr))

async function getChangesForCoordinatesInPr(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.get(coordinates, request.params.pr)
  if (result) return response.status(200).send(result)
  response.sendStatus(404)
}

// Get data needed by review UI
router.get('/pr/:pr', asyncMiddleware(getPr))

async function getPr(request, response) {
  try {
    const url = curationService.getCurationUrl(request.params.pr)
    const changes = await curationService.getChangedDefinitions(request.params.pr)
    return response.status(200).send({ url, changes })
  } catch (exception) {
    if (exception.code === 404) return response.sendStatus(404)
    throw exception
  }
}

// Get an existing patch for a specific revision of a component
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getCurationForCoordinates))

async function getCurationForCoordinates(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.get(coordinates)
  if (result) return response.status(200).send(result)
  response.sendStatus(404)
}

// Search for any patches related to the given path, as much as is given
router.get('/:type?/:provider?/:namespace?/:name?', asyncMiddleware(listCurations))

async function listCurations(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request)
  const result = await curationService.list(coordinates)
  response.status(200).send(result)
}

router.patch('', asyncMiddleware(updateCurations))

async function updateCurations(request, response) {
  const serviceGithub = request.app.locals.service.github.client
  const userGithub = request.app.locals.user.github.client
  const info = request.app.locals.user.github.info
  let curationErrors = []
  request.body.patches.forEach(entry => {
    const curation = new Curation(entry)
    if (curation.errors.length > 0) curationErrors = [...curationErrors, curation.errors]
  })
  if (curationErrors.length > 0) return response.status(400).send({ errors: curationErrors })
  try {
    const result = await curationService.addOrUpdate(userGithub, serviceGithub, info, request.body)
    response.status(200).send({
      prNumber: result.data.number,
      url: curationService.getCurationUrl(result.data.number)
    })
  } catch (error) {
    return response.status(400).send(error)
  }
}

router.post('/sync', permissionsCheck('curate'), asyncMiddleware(syncAllContributions))

async function syncAllContributions(request, response) {
  await curationService.syncAllContributions(request.app.locals.user.github.client)
  response.send({ status: 'OK' })
}

let curationService

function setup(service) {
  curationService = service
  return router
}

module.exports = setup
