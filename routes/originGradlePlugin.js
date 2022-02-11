// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { get, uniq } = require('lodash')
const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const GradleCoordinatesMapper = require('../lib/gradleCoordinatesMapper')

// Gradle plugin documentation: https://docs.gradle.org/current/userguide/plugins.html
const gradleHelper = new GradleCoordinatesMapper()

// Get versions
router.get(
  '/:pluginId/revisions',
  asyncMiddleware(async (request, response) => {
    const { pluginId } = request.params
    const answer = await gradleHelper.getMavenMetadata(pluginId)
    const meta = answer && await parseXml(answer)
    const result = get(meta, 'metadata.versioning.0.versions.0.version') || []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

// Search
router.get(
  '/:pluginId',
  asyncMiddleware(async (request, response) => {
    const { pluginId } = request.params
    const isValid = await gradleHelper.getMavenMetadata(pluginId)
    const result = isValid ? [{ id: pluginId }] : []
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
