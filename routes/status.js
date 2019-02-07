// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('', (request, response) => {
  response.send(statusService.list())
})

router.get('/:status', asyncMiddleware(getRequests))
async function getRequests(request, response) {
  const cacheKey = `status_${request.params.status.toLowerCase()}`
  let status = await request.app.locals.cache.get(cacheKey)
  if (!status) {
    status = await statusService.get(request.params.status)
    await request.app.locals.cache.set(cacheKey, status, 60 * 60 /* 1 hr */)
  }
  response.send(status)
}

let statusService

function setup(service) {
  statusService = service
  return router
}

module.exports = setup
