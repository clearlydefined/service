// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('../business/noticeService').AttachmentStore} AttachmentStore */

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()

// Get a proposed patch for a specific revision of a component
router.get('/:id', asyncMiddleware(getAttachment))

/**
 * @param {Request} request
 * @param {Response} response
 */
async function getAttachment(request, response) {
  const result = await attachmentStore.get(/** @type {string} */ (request.params.id))
  if (!result) return response.sendStatus(404)
  return response.status(200).send(result)
}

/** @type {AttachmentStore} */
let attachmentStore
/**
 * @param {AttachmentStore} attachment
 */
function setup(attachment) {
  attachmentStore = attachment
  return router
}
module.exports = setup
