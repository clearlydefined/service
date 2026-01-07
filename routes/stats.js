// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statsService.list())
})

router.get('/:stat', asyncMiddleware(getStat))
async function getStat(request, response) {
  const stat = await statsService.get(request.params.stat)
  response.send({ value: stat })
}

let statsService

function setup(stats) {
  statsService = stats
  return router
}

module.exports = setup
