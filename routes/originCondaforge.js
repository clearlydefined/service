// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = express.Router()

const channel = 'conda-forge'
/**
 * @type {import("../lib/condaRepoAccess").CondaRepoAccess}
 */
let repoAccess

router.get(
  '/:subdir/:name/revisions',
  asyncMiddleware(getRevisions)
)

/**
 * @param { express.Request } req
 * @param { express.Response } res
 */
async function getRevisions(req, res)
{
    const { name, subdir } = req.params
    try {
      const revisions = await repoAccess.getRevisions(channel, subdir, name)
      res.status(200).send(revisions)
    } catch (/** @type {any} */error) {
      res.status(404).send(error.message)
    }
}

router.get('/:name', asyncMiddleware(getPackages))

/**
 * @param { express.Request } req
 * @param { express.Response } res
 */
async function getPackages(req, res)
{
      const { name } = req.params
    try {
      const matches = await repoAccess.getPackages(channel, name)
      res.status(200).send(matches)
    } catch (/** @type {any} */error) {
      res.status(404).send(error.message)
    }
}

/**
 *
 * @param {import('../lib/condaRepoAccess').CondaRepoAccess} condaForgeRepoAccess
 * @returns {express.Router}
 */
function setup(condaForgeRepoAccess) {
  repoAccess = condaForgeRepoAccess
  return router
}

module.exports = setup
