// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import express from 'express'
import type { AttachmentStore } from '../business/noticeService.js'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

// Get a proposed patch for a specific revision of a component
router.get('/:id', asyncMiddleware(getAttachment))

async function getAttachment(request: Request, response: Response) {
  const result = await attachmentStore.get(request.params.id as string)
  if (!result) {
    return response.sendStatus(404)
  }
  return response.status(200).send(result)
}

let attachmentStore: AttachmentStore

function setup(attachment: AttachmentStore): Router {
  attachmentStore = attachment
  return router
}
export default setup
