// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const semver = require('semver')
const EntityCoordinates = require('./entityCoordinates')
const ResultCoordinates = require('./resultCoordinates')

function toResultCoordinatesFromRequest(request) {
  return new ResultCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : request.params.namespace,
    request.params.name,
    request.params.revision,
    request.params.tool,
    request.params.toolVersion
  )
}

function toEntityCoordinatesFromRequest(request) {
  return new EntityCoordinates(
    request.params.type,
    request.params.provider,
    request.params.namespace === '-' ? null : request.params.namespace,
    request.params.name,
    request.params.revision,
    request.params.tool,
    request.params.toolVersion
  )
}

function getLatestVersion(versions) {
  if (!Array.isArray(versions)) return versions
  if (versions.length === 0) return null
  if (versions.length === 1) return versions[0]
  return versions
    .filter(v => semver.prerelease(v) === null)
    .reduce(
      (max, current) => (semver.gt(semver.coerce(current).version, semver.coerce(max).version) ? current : max),
      versions[0]
    )
}

module.exports = {
  toEntityCoordinatesFromRequest,
  toResultCoordinatesFromRequest,
  getLatestVersion
}
