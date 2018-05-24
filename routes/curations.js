// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const Github = require('../lib/github')

// Get a proposed patch for a specific revision of a component
router.get(
  '/:type/:provider/:namespace/:name/:revision/pr/:pr',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    return curationService.get(coordinates, request.params.pr).then(result => {
      if (result) return response.status(200).send(result)
      response.sendStatus(404)
    })
  })
)

// Get an existing patch for a specific revision of a component
router.get(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    return curationService.get(coordinates).then(result => {
      if (result) return response.status(200).send(result)
      response.sendStatus(404)
    })
  })
)

// Search for any patches related to the given path, as much as is given
router.get(
  '/:type?/:provider?/:namespace?/:name?',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    return curationService.list(coordinates).then(result => response.status(200).send(result))
  })
)

// Create a patch for a specific revision of a component
router.patch(
  '/:type/:provider/:namespace/:name/:revision',
  asyncMiddleware(async (request, response) => {
    const coordinates = utils.toEntityCoordinatesFromRequest(request)
    const token = request.app.locals.config.curation.store.github.token
    const serviceGithub = Github.getClient({ token })
    const userGithub = request.app.locals.user.github.client
    return curationService
      .addOrUpdate(userGithub, serviceGithub, coordinates, request.body)
      .then(() => response.sendStatus(200))
  })
)

router.patch(
  '',
  asyncMiddleware(async (request, response) => {
    const token = request.app.locals.config.curation.store.github.token
    const serviceGithub = Github.getClient({ token })
    const userGithub = request.app.locals.user.github.client
    return curationService
      .addOrUpdate(userGithub, serviceGithub, request.body)
      .then(() => response.sendStatus(200))
  })
)

let curationService

function setup(service) {
  curationService = service
  return router
}

module.exports = setup
