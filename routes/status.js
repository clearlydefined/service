// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('', (request, response) => {
  response.send(statusService.list())
})

router.get('/:key', asyncMiddleware(getRequests))
async function getRequests(request, response) {
  const result = await statusService.get(request.params.key)
  response.send(result)
}

let statusService

function setup(service) {
  statusService = service
  return router
}

module.exports = setup
