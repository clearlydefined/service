// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const AttachmentCoordinates = require('../lib/attachmentCoordinates')

// Get a proposed patch for a specific revision of a component
router.get('/:token', asyncMiddleware(getAttachment))

async function getAttachment(request, response) {
  const coordinates = new AttachmentCoordinates(request.params.token)
  const result = await harvestStore.getAttachment(coordinates)
  if (!result) return response.sendStatus(404)
  response.status(200).send(result.attachment)
}

let harvestStore
function setup(harvest) {
  harvestStore = harvest
  return router
}
module.exports = setup
