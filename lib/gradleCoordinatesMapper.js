// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const { get } = require('lodash')
const EntityCoordinates = require('./entityCoordinates')

const repoBaseUrl = 'https://plugins.gradle.org'

class GradleCoordinatesMapper {

  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  _shouldResolve(coordinates) {
    return !coordinates.namespace
  }

  async _resolve(coordinates) {
    const answer = await this._getPomFor(coordinates)
    const pluginMarker = answer && await parseXml(answer)
    const mappedGav = get(pluginMarker, 'project.dependencies.0.dependency.0')
    return mappedGav && {
      namespace: get(mappedGav, 'groupId.0'),
      name: get(mappedGav, 'artifactId.0'),
      revision: get(mappedGav, 'version.0')
    }
  }

  async _getPomFor(coordinates) {
    return this._query(this._buildPomUrl(coordinates))
      .catch(error => {
        if (error.statusCode === 404) return null
        throw error
      })
  }

  _buildPomUrl(coordinates) {
    const { pluginBaseUrl, plugin } = GradleCoordinatesMapper.buildPluginInfo(coordinates)
    return `${pluginBaseUrl}/${coordinates.revision}/${plugin}-${coordinates.revision}.pom`
  }

  async _query(url) {
    return await requestPromise({ url, method: 'GET', json: false })
  }

  static buildPluginInfo({ name }) {
    const path = `${name.replace(/\./g, '/')}`
    const plugin = `${name}.gradle.plugin`
    const pluginBaseUrl = `${repoBaseUrl}/m2/${path}/${plugin}`
    return { pluginBaseUrl, plugin }
  }
}

module.exports = GradleCoordinatesMapper
