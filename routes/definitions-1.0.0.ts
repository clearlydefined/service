// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'
import express from 'express'
import type { DefinitionService } from '../business/definitionService.js'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import EntityCoordinates from '../lib/entityCoordinates.ts'
import * as utils from '../lib/utils.ts'
import validator from '../schemas/validator.ts'

router.get('/', asyncMiddleware(getDefinition))

async function getDefinition(req: Request, resp: Response) {
  const coordinates = req.query.coordinates as string
  const pr = req.query.pr
  const expand = req.query.expand as string | undefined
  const force = (req.query.force as string | undefined) === 'true'
  let coordinatesEntity = EntityCoordinates.fromString(coordinates)
  const isValid = validator.validate('definitions-get-dto', {
    coordinates: coordinatesEntity || undefined,
    pr,
    force,
    expand: expand?.split(',')
  })
  if (!isValid) {
    return resp.status(400).send(validator.errors!.map(e => e.message))
  }
  try {
    coordinatesEntity = await utils.toNormalizedEntityCoordinates(coordinatesEntity!)
  } catch {
    return resp.status(404).send(`The ${encodeURIComponent(coordinates)} is not public. An internal error occurred.`)
  }
  const result = await definitionService.get(coordinatesEntity, pr as string | undefined, force, expand)

  return resp.status(200).send(result)
}

let definitionService: DefinitionService

function setup(definition: DefinitionService, testFlag = false): Router {
  definitionService = definition

  if (testFlag) {
    const _router = router as any
    _router._getDefinition = getDefinition
  }
  return router
}

export default setup
