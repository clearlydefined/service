// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const express = require('express')
const router = express.Router()
const utils = require('../lib/utils')
const EntityCoordinates = require('../lib/entityCoordinates')
const validator = require('../schemas/validator')

router.get('/', asyncMiddleware(getDefinition))

async function getDefinition(req, resp) {
  const { coordinates, pr, expand } = req.query
  const force = req.query.force === true || req.query.force === 'true'
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
  } catch (err) {
    return resp.status(404).send(`The ${encodeURIComponent(coordinates)} is not public.`)
  }
  const result = await definitionService.get(coordinatesEntity, pr, force, expand)

  return resp.status(200).send(result)
}

let definitionService

function setup(definition, testFlag = false) {
  definitionService = definition

  if (testFlag) {
    router._getDefinition = getDefinition
  }
  return router
}

module.exports = setup
