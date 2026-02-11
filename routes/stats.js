// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../business/statsService').StatsService} StatsService */

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statsService.list())
})

router.get('/:stat', asyncMiddleware(getStat))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getStat(request, response) {
  const stat = await statsService.get(/** @type {string} */ (request.params.stat))
  response.send({ value: stat })
}

/** @type {StatsService} */
let statsService

/**
 * @param {StatsService} stats
 */
function setup(stats) {
  statsService = stats
  return router
}

module.exports = setup
