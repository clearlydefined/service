// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import type { StatusService } from '../business/statusService.ts'

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statusService.list())
})

router.get('/:status', asyncMiddleware(getRequests))

async function getRequests(request: Request, response: Response) {
  const status = await statusService.get(request.params.status as string)
  response.send(status)
}

let statusService: StatusService

function setup(service: StatusService): Router {
  statusService = service
  return router
}

export default setup
