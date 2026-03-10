// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../business/noticeService').NoticeService} NoticeService */

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')
const logger = require('../providers/logging/logger')
const bodyParser = require('body-parser')

// Post a (set of) component to be included in a single NOTICE file
router.post('/', bodyParser.json({ limit: '0.6mb' }), asyncMiddleware(generateNotices))

/**
 *
 * {
 *   coordinates: [""],
 *   output: "text|html|template|json",
 *   options: { "template": ""}
 * }
 */
/**
 * @param {Request} request
 * @param {Response} response
 * @returns {Promise<void>}
 */
async function generateNotices(request, response) {
  if (!validator.validate('notice-request', request.body)) {
    response.status(400).send(validator.errorsText())
    return
  }
  const coordinates = request.body.coordinates.map((/** @type {any} */ entry) => EntityCoordinates.fromString(entry))
  const log = logger()
  log.info('notice_generate:start', { ts: new Date().toISOString(), cnt: coordinates.length })
  const result = await noticeService.generate(coordinates, request.body.renderer, request.body.options)
  log.info('notice_generate:prepared', { ts: new Date().toISOString(), cnt: coordinates.length })
  response.send(result)
  log.info('notice_generate:sent', { ts: new Date().toISOString(), cnt: coordinates.length })
  return
}

/** @type {NoticeService} */
let noticeService

/**
 * @param {NoticeService} notice
 */
function setup(notice) {
  noticeService = notice
  return router
}
module.exports = setup
