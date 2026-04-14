// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import express from 'express'
import type createCondaRepoAccess from '../lib/condaRepoAccess.ts'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

const channel = 'conda-forge'
let repoAccess: any

router.get(
  '/:subdir/:name/revisions',
  asyncMiddleware(async (req, res) => {
    const { name, subdir } = req.params
    try {
      const revisions = await repoAccess.getRevisions(channel, subdir, name)
      res.status(200).send(revisions)
    } catch (e) {
      const error = e as Error
      res.status(404).send(error.message)
    }
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (req, res) => {
    const { name } = req.params
    try {
      const matches = await repoAccess.getPackages(channel, name)
      res.status(200).send(matches)
    } catch (e) {
      const error = e as Error
      res.status(404).send(error.message)
    }
  })
)

function setup(condaForgeRepoAccess: ReturnType<typeof createCondaRepoAccess>): Router {
  repoAccess = condaForgeRepoAccess
  return router
}

export default setup
