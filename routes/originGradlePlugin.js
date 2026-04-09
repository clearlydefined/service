// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.js'

const router = express.Router()

import lodash from 'lodash'

const { get, uniq } = lodash

import { promisify } from 'node:util'
import xml2js from 'xml2js'

const parseXml = promisify(xml2js.parseString)

import GradleCoordinatesMapper from '../lib/gradleCoordinatesMapper.ts'

// Gradle plugin documentation: https://docs.gradle.org/current/userguide/plugins.html
const gradleHelper = new GradleCoordinatesMapper()

// Get versions
router.get(
  '/:pluginId/revisions',
  asyncMiddleware(async (request, response) => {
    const pluginId = /** @type {string} */ (request.params.pluginId)
    const answer = await gradleHelper.getMavenMetadata(pluginId)
    const meta = answer && (await parseXml(answer))
    const result = get(meta, 'metadata.versioning.0.versions.0.version') || []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

// Search
router.get(
  '/:pluginId',
  asyncMiddleware(async (request, response) => {
    const pluginId = /** @type {string} */ (request.params.pluginId)
    const isValid = await gradleHelper.getMavenMetadata(pluginId)
    const result = isValid ? [{ id: pluginId }] : []
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

export default setup
