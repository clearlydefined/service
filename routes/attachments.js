// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()

// Get a proposed patch for a specific revision of a component
router.get('/:id', asyncMiddleware(getAttachment))

async function getAttachment(request, response) {
  const result = await attachmentStore.get(request.params.id)
  if (!result) return response.sendStatus(404)
  response.status(200).send(result)
}

let attachmentStore
function setup(attachment) {
  attachmentStore = attachment
  return router
}
module.exports = setup
