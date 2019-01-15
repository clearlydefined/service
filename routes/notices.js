// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const EntityCoordinates = require('../lib/entityCoordinates')

router.post(
  '/',
  asyncMiddleware(async (request, response) => {
    const coordinatesList = request.body.coordinates.map(entry => EntityCoordinates.fromString(entry))
    const output = await noticeService.generate(coordinatesList)
    response.send(output)
  })
)

let noticeService

function setup(notice) {
  noticeService = notice
  return router
}
module.exports = setup
