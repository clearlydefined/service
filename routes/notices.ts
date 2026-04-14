// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import type { NoticeService } from '../business/noticeService.ts'

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import bodyParser from 'body-parser'
import EntityCoordinates from '../lib/entityCoordinates.ts'
import logger from '../providers/logging/logger.ts'
import validator from '../schemas/validator.ts'

// Post a (set of) component to be included in a single NOTICE file
router.post('/', bodyParser.json({ limit: '0.6mb' }), asyncMiddleware(generateNotices))

/**
 * {
 *   coordinates: [""],
 *   output: "text|html|template|json",
 *   options: { "template": ""}
 * }
 */
async function generateNotices(request: Request, response: Response): Promise<void> {
  if (!validator.validate('notice-request', request.body)) {
    response.status(400).send(validator.errorsText())
    return
  }
  const coordinates = request.body.coordinates.map((entry: any) => EntityCoordinates.fromString(entry))
  const log = logger()
  log.info('notice_generate:start', { ts: new Date().toISOString(), cnt: coordinates.length })
  const result = await noticeService.generate(coordinates, request.body.renderer, request.body.options)
  log.info('notice_generate:prepared', { ts: new Date().toISOString(), cnt: coordinates.length })
  response.send(result)
  log.info('notice_generate:sent', { ts: new Date().toISOString(), cnt: coordinates.length })
  return
}

let noticeService: NoticeService

function setup(notice: NoticeService): Router {
  noticeService = notice
  return router
}
export default setup
