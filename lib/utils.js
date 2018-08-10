// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const semver = require('semver')
const EntityCoordinates = require('./entityCoordinates')
const ResultCoordinates = require('./resultCoordinates')
const moment = require('moment')

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
  return versions.reduce((max, current) => {
    const normalized = _normalizeVersion(current)
    if (!normalized || semver.prerelease(normalized) !== null) return max
    return semver.gt(normalized, _normalizeVersion(max)) ? current : max
  }, versions[0])
}

function extractDate(dateAndTime) {
  if (!dateAndTime) return null
  return moment(dateAndTime).format('YYYY-MM-DD')
}

function _normalizeVersion(version) {
  if (version == '1') return '1.0.0' // version '1' is not semver valid see https://github.com/clearlydefined/crawler/issues/124
  return semver.valid(version) ? version : null
}

module.exports = {
  toEntityCoordinatesFromRequest,
  toResultCoordinatesFromRequest,
  getLatestVersion,
  extractDate
}
