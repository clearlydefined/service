// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()

router.get('', (request, response) => {
  response.send(statsService.list())
})

router.get('/:stat', asyncMiddleware(getStat))
async function getStat(request, response) {
  const cacheKey = `stat_${request.params.stat.toLowerCase()}`
  let stat = await request.app.locals.cache.get(cacheKey)
  if (!stat) {
    stat = await statsService.get(request.params.stat)
    await request.app.locals.cache.set(cacheKey, stat, 60 * 60 /* 1 hr */)
  }
  response.send({ value: stat })
}

let statsService

function setup(stats) {
  statsService = stats
  return router
}

module.exports = setup
