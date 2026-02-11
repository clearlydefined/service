// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = express.Router()

const channel = 'conda-forge'
/** @type {any} */
let repoAccess

router.get(
  '/:subdir/:name/revisions',
  asyncMiddleware(async (req, res) => {
    const { name, subdir } = req.params
    try {
      const revisions = await repoAccess.getRevisions(channel, subdir, name)
      res.status(200).send(revisions)
    } catch (e) {
      const error = /** @type {Error} */ (e)
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
      const error = /** @type {Error} */ (e)
      res.status(404).send(error.message)
    }
  })
)

/** @param {any} condaForgeRepoAccess */
function setup(condaForgeRepoAccess) {
  repoAccess = condaForgeRepoAccess
  return router
}

module.exports = setup
