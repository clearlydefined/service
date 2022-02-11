// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const { get } = require('lodash')
const EntityCoordinates = require('./entityCoordinates')

const repoBaseUrl = 'https://plugins.gradle.org/m2'

class GradleCoordinatesMapper {

  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  _shouldResolve(coordinates) {
    return !coordinates.namespace && coordinates.name
  }

  async _resolve(coordinates) {
    const markerCoordinates = coordinates.revision ?
      coordinates :
      { ...coordinates, revision: await this._getLatestVersion(coordinates) }
    if (!markerCoordinates.revision) return

    const mappedGav = await this._getImplementation(markerCoordinates)
    return mappedGav && {
      namespace: get(mappedGav, 'groupId.0'),
      name: get(mappedGav, 'artifactId.0'),
      revision: coordinates.revision ? get(mappedGav, 'version.0') : undefined
    }
  }

  async _getLatestVersion({ name }) {
    const answer = await this.getMavenMetadata(name)
    const meta = answer && await parseXml(answer)
    return get(meta, 'metadata.versioning.0.release.0')
  }

  async _getImplementation(markerCoordinates) {
    const answer = await this._request(this._buildPomUrl((markerCoordinates)))
    const pluginMarker = answer && await parseXml(answer)
    return get(pluginMarker, 'project.dependencies.0.dependency.0')
  }

  async _request(url) {
    return this._handleRequest(url)
      .catch(error => {
        if (error.statusCode === 404) return null
        throw error
      })
  }

  _buildPomUrl(coordinates) {
    const { pluginBaseUrl, plugin } = this._buildPluginInfo(coordinates)
    return `${pluginBaseUrl}/${coordinates.revision}/${plugin}-${coordinates.revision}.pom`
  }

  async _handleRequest(url) {
    return await requestPromise({ url, method: 'GET', json: false })
  }

  _buildPluginInfo({ name }) {
    const path = `${name.replace(/\./g, '/')}`
    const plugin = `${name}.gradle.plugin`
    const pluginBaseUrl = `${repoBaseUrl}/${path}/${plugin}`
    return { pluginBaseUrl, plugin }
  }

  async getMavenMetadata(pluginId) {
    const { pluginBaseUrl } = this._buildPluginInfo({ name: pluginId })
    const url = `${pluginBaseUrl}/maven-metadata.xml`
    return await this._request(url)
  }
}

module.exports = GradleCoordinatesMapper
