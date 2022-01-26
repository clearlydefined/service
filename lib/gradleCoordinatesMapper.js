// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const { get } = require('lodash')
const EntityCoordinates = require('./entityCoordinates')

class GradleCoordinatesMapper {
  constructor() {
    this._baseUrl = 'https://plugins.gradle.org'
  }

  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  _shouldResolve(coordinates) {
    return !coordinates.namespace
  }

  async _resolve(coordinates) {
    return this._query(this._buildQueryUrl(coordinates))
      .then(async answer => {
        const pluginMarker = answer && await parseXml(answer)
        const mappedGav = get(pluginMarker, 'project.dependencies.0.dependency.0')
        return mappedGav && {
          namespace: get(mappedGav, 'groupId.0'),
          name: get(mappedGav, 'artifactId.0'),
          revision: get(mappedGav, 'version.0')
        }
      }, error => {
        if (error.statusCode === 404) return null
        throw error
      })
  }

  _buildQueryUrl(coordinates) {
    const pathForName = `${coordinates.name.replace(/\./g, '/')}`
    const plugin = `${coordinates.name}.gradle.plugin`
    return `${this._baseUrl}/m2/${pathForName}/${plugin}/${coordinates.revision}/${plugin}-${coordinates.revision}.pom`
  }

  async _query(url) {
    return await requestPromise({ url, method: 'GET', json: false })
  }
}

module.exports = GradleCoordinatesMapper
