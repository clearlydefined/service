// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statusService.list())
})

router.get('/:status', asyncMiddleware(getRequests))
async function getRequests(request, response) {
  const status = await statusService.get(request.params.status)
  response.send(status)
}

let statusService

function setup(service) {
  statusService = service
  return router
}

module.exports = setup
