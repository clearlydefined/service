// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router, Request, Response } from 'express'
import type createCondaRepoAccess from '../lib/condaRepoAccess.ts'
import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

let repoAccess: any

router.get('/:channel/:subdir/:name/revisions', asyncMiddleware(getOriginCondaRevisions))

async function getOriginCondaRevisions(request: Request, response: Response) {
  const { channel, subdir, name } = request.params
  try {
    const revisions = await repoAccess.getRevisions(channel, subdir, name)
    response.status(200).send(revisions)
  } catch (e) {
    const error = e as Error
    response.status(404).send(error.message)
  }
}

router.get('/:channel/:name', asyncMiddleware(getOriginConda))

async function getOriginConda(request: Request, response: Response) {
  const { channel, name } = request.params
  try {
    const matches = await repoAccess.getPackages(channel, name)
    response.status(200).send(matches)
  } catch (e) {
    const error = e as Error
    response.status(404).send(error.message)
  }
}

function setup(condaRepoAccess: ReturnType<typeof createCondaRepoAccess>, testflag = false): Router {
  if (testflag) {
    const _router = router as any
    _router._getOriginConda = getOriginConda
    _router._getOriginCondaRevisions = getOriginCondaRevisions
  }
  repoAccess = condaRepoAccess
  return router
}
export default setup
