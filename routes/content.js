// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const ResultCoordinates = require('../lib/resultCoordinates')

// Get a proposed patch for a specific revision of a component
router.get('/:contentToken', asyncMiddleware(getContent))

async function getContent(request, response) {
  // TODO this is a hack. The coordinates are not intended to be sparse. Here make sure the
  // token is the "namespace" to avoid the '-' showing up. Fix is likely to have an explicit
  // ContentCoordinates class that has the right shape and generalize the stores to just take
  // "coordinates" and not worry about how they are structured.
  const coordinates = new ResultCoordinates('content', null, request.params.contentToken)
  const result = await contentStore.get(coordinates)
  if (result) return response.status(200).send(result.content)
  response.sendStatus(404)
}

let contentStore
function setup(content) {
  contentStore = content
  return router
}
module.exports = setup
