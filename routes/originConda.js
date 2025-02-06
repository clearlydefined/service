// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()

let repoAccess

router.get('/:channel/:subdir/:name/revisions', asyncMiddleware(getOriginCondaRevisions))
async function getOriginCondaRevisions(request, response) {
  let { channel, subdir, name } = request.params
  try {
    const revisions = await repoAccess.getRevisions(
      encodeURIComponent(channel),
      encodeURIComponent(subdir),
      encodeURIComponent(name)
    )
    response.status(200).send(revisions)
  } catch (error) {
    response.status(404).send(error.message)
  }
}

router.get('/:channel/:name', asyncMiddleware(getOriginConda))
async function getOriginConda(request, response) {
  let { channel, name } = request.params
  try {
    const matches = await repoAccess.getPackages(encodeURIComponent(channel), encodeURIComponent(name))
    response.status(200).send(matches)
  } catch (error) {
    response.status(404).send(error.message)
  }
}

function setup(condaRepoAccess, testflag = false) {
  if (testflag) {
    router._getOriginConda = getOriginConda
    router._getOriginCondaRevisions = getOriginCondaRevisions
  }
  repoAccess = condaRepoAccess
  return router
}
module.exports = setup
