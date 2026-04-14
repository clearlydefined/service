// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import type { StatsService } from '../business/statsService.ts'

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

router.get('/', (_request, response) => {
  response.send(statsService.list())
})

router.get('/:stat', asyncMiddleware(getStat))

async function getStat(request: Request, response: Response) {
  const stat = await statsService.get(request.params.stat as string)
  response.send({ value: stat })
}

let statsService: StatsService

function setup(stats: StatsService): Router {
  statsService = stats
  return router
}

export default setup
