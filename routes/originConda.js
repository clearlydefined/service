// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()

/** @type {any} */
let repoAccess

router.get('/:channel/:subdir/:name/revisions', asyncMiddleware(getOriginCondaRevisions))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getOriginCondaRevisions(request, response) {
  let { channel, subdir, name } = request.params
  try {
    const revisions = await repoAccess.getRevisions(channel, subdir, name)
    response.status(200).send(revisions)
  } catch (e) {
    const error = /** @type {Error} */ (e)
    response.status(404).send(error.message)
  }
}

router.get('/:channel/:name', asyncMiddleware(getOriginConda))
/**
 * @param {Request} request
 * @param {Response} response
 */
async function getOriginConda(request, response) {
  let { channel, name } = request.params
  try {
    const matches = await repoAccess.getPackages(channel, name)
    response.status(200).send(matches)
  } catch (e) {
    const error = /** @type {Error} */ (e)
    response.status(404).send(error.message)
  }
}

/** @param {any} condaRepoAccess */
function setup(condaRepoAccess, testflag = false) {
  if (testflag) {
    const _router = /** @type {any} */ (router)
    _router._getOriginConda = getOriginConda
    _router._getOriginCondaRevisions = getOriginCondaRevisions
  }
  repoAccess = condaRepoAccess
  return router
}
module.exports = setup
