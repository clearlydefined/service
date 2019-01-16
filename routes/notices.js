// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')

router.post('/', asyncMiddleware(generateNotices))

async function generateNotices(request, response) {
  if (!validator.validate('notice-request', request.body)) return response.status(400).send(validator.errorsText())
  const coordinatesList = request.body.coordinates.map(entry => EntityCoordinates.fromString(entry))
  const output = await noticeService.generate(coordinatesList, request.body.template)
  response.send(output)
}

let noticeService

function setup(notice) {
  noticeService = notice
  return router
}
module.exports = setup
