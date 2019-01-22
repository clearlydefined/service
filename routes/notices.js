// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')

router.post('/', asyncMiddleware(generateNotices))

/**
 *
 * {
 *   coordinates: [""],
 *   output: "text|html|template|json",
 *   options: { "template": ""}
 * }
 */
async function generateNotices(request, response) {
  if (!validator.validate('notice-request', request.body)) return response.status(400).send(validator.errorsText())
  const coordinates = request.body.coordinates.map(entry => EntityCoordinates.fromString(entry))
  const result = await noticeService.generate(coordinates, request.body.renderer, request.body.options)
  response.send(result)
}

let noticeService

function setup(notice) {
  noticeService = notice
  return router
}
module.exports = setup
