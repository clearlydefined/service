// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

router.get('/', asyncMiddleware(getDefinition))

/**
 * @param {Request} req
 * @param {Response} resp
 */
async function getDefinition(req, resp) {
  const coordinates = /** @type {string} */ (req.query.coordinates)
  const pr = req.query.pr
  const expand = /** @type {string|undefined} */ (req.query.expand)
  const force = /** @type {string} */ (req.query.force) === 'true'
  let coordinatesEntity = EntityCoordinates.fromString(coordinates)
  const isValid = validator.validate('definitions-get-dto', {
    coordinates: coordinatesEntity || undefined,
    pr,
    force,
    expand: expand?.split(',')
  })
  if (!isValid) {
    return resp.status(400).send(validator.errors.map(e => e.message))
  }
  try {
    coordinatesEntity = await utils.toNormalizedEntityCoordinates(coordinatesEntity)
  } catch {
    return resp.status(404).send(`The ${encodeURIComponent(coordinates)} is not public. An internal error occurred.`)
  }
  const result = await definitionService.get(coordinatesEntity, pr, force, expand)

  return resp.status(200).send(result)
}

/** @type {any} */
let definitionService

/**
 * @param {any} definition
 * @param {boolean} [testFlag]
 */
function setup(definition, testFlag = false) {
  definitionService = definition

  if (testFlag) {
    (router)._getDefinition = getDefinition
  }
  return router
}

module.exports = setup
