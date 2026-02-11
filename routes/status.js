// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../business/statusService').StatusService} StatusService */

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statusService.list())
})

router.get('/:status', asyncMiddleware(getRequests))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getRequests(request, response) {
  const status = await statusService.get(/** @type {string} */ (request.params.status))
  response.send(status)
}

/** @type {StatusService} */
let statusService

/**
 * @param {StatusService} service
 */
function setup(service) {
  statusService = service
  return router
}

module.exports = setup
