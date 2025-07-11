// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { callFetch: requestPromise } = require('../lib/fetch')
const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const { get } = require('lodash')
const EntityCoordinates = require('./entityCoordinates')

/**
 * @typedef {import('./fetch').FetchFunction} FetchFunction
 *
 * @typedef {import('./fetch').FetchResponse} FetchResponse
 *
 * @typedef {import('./gradleCoordinatesMapper').GradleCoordinates} GradleCoordinates
 *
 * @typedef {import('./gradleCoordinatesMapper').GradleResolutionResult} GradleResolutionResult
 *
 * @typedef {import('./gradleCoordinatesMapper').GradlePluginInfo} GradlePluginInfo *
 *
 * @typedef {import('./entityCoordinates').default} EntityCoordinatesClass
 */

/** @type {string} Base URL for Gradle Plugin Portal Maven repository */
const repoBaseUrl = 'https://plugins.gradle.org/m2'

/**
 * Maps Gradle plugin coordinates to their underlying Maven coordinates.
 *
 * This class resolves Gradle plugin coordinates by querying the Gradle Plugin Portal's Maven repository to find the
 * actual Maven coordinates (groupId, artifactId, version) of the plugin implementation. Gradle plugins are published as
 * marker artifacts that contain dependency information pointing to the actual implementation.
 *
 * @example
 *   ```javascript
 *   const mapper = new GradleCoordinatesMapper();
 *   const coordinates = { name: 'org.springframework.boot', type: 'gradleplugin' };
 *   const resolved = await mapper.map(coordinates);
 *   console.log(resolved.namespace); // 'org.springframework.boot'
 *   console.log(resolved.name); // 'spring-boot-gradle-plugin'
 *   ```
 */
class GradleCoordinatesMapper {
  /**
   * Maps Gradle plugin coordinates to their underlying Maven coordinates.
   *
   * This method resolves Gradle plugin coordinates by:
   *
   * 1. Checking if resolution is needed (no namespace and has name)
   * 2. Finding the latest version if no revision is provided
   * 3. Fetching the plugin marker POM to get the actual Maven coordinates
   *
   * @param {GradleCoordinates} coordinates - The Gradle plugin coordinates to map
   * @returns {Promise<EntityCoordinatesClass | null>} Promise that resolves to EntityCoordinates with Maven
   *   coordinates, or null if not resolvable
   * @throws {Error} When repository requests fail with non-404 errors
   */
  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  /**
   * Determines if the given coordinates should be resolved.
   *
   * Resolution is needed when there's no namespace but there is a name, indicating this is a Gradle plugin that needs
   * to be mapped to its Maven coordinates.
   *
   * @private
   * @param {GradleCoordinates} coordinates - The coordinates to check
   * @returns {boolean} True if the coordinates should be resolved, false otherwise
   */
  _shouldResolve(coordinates) {
    return !coordinates.namespace && !!coordinates.name
  }

  /**
   * Resolves coordinates by fetching the plugin marker and extracting Maven coordinates.
   *
   * @private
   * @param {GradleCoordinates} coordinates - The coordinates to resolve
   * @returns {Promise<GradleResolutionResult | null>} Promise that resolves to resolution result with Maven
   *   coordinates, or null if not found
   * @throws {Error} When repository requests fail with non-404 errors
   */
  async _resolve(coordinates) {
    const markerCoordinates = coordinates.revision
      ? coordinates
      : { ...coordinates, revision: await this._getLatestVersion(coordinates) }
    if (!markerCoordinates.revision) return null

    const mappedGav = await this._getImplementation(markerCoordinates)
    return (
      mappedGav && {
        namespace: /** @type {string} */ (get(mappedGav, 'groupId.0')),
        name: /** @type {string} */ (get(mappedGav, 'artifactId.0')),
        revision: coordinates.revision ? /** @type {string} */ (get(mappedGav, 'version.0')) : undefined
      }
    )
  }

  /**
   * Gets the latest version of a plugin from its Maven metadata.
   *
   * @private
   * @param {{ name: string }} coordinates - Object containing the plugin name
   * @returns {Promise<string | undefined>} Promise that resolves to the latest version string, or undefined if not
   *   found
   * @throws {Error} When metadata request fails with non-404 errors
   */
  async _getLatestVersion({ name }) {
    const answer = await this.getMavenMetadata(name)
    const meta = answer && (await parseXml(answer))
    return get(meta, 'metadata.versioning.0.release.0')
  }

  /**
   * Gets the Maven coordinates from a plugin marker POM.
   *
   * The marker POM contains a dependency that points to the actual plugin implementation. This method extracts the
   * groupId, artifactId, and version from that dependency.
   *
   * @private
   * @param {GradleCoordinates} markerCoordinates - The marker coordinates including name and revision
   * @returns {Promise<string | null>} Promise that resolves to the first dependency from the marker POM, or null if not
   *   found
   * @throws {Error} When POM request fails with non-404 errors
   */
  async _getImplementation(markerCoordinates) {
    const answer = await this._request(this._buildPomUrl(markerCoordinates))
    const pluginMarker = answer && (await parseXml(answer))
    return get(pluginMarker, 'project.dependencies.0.dependency.0')
  }

  /**
   * Makes a request and handles 404 errors gracefully.
   *
   * @private
   * @param {string} url - The URL to request
   * @returns {Promise<string | FetchResponse | null>} Promise that resolves to the response body, or null if 404
   * @throws {Error} When request fails with non-404 errors
   */
  async _request(url) {
    return this._handleRequest(url).catch(
      /** @returns {string | FetchResponse | null} */
      error => {
        if (error.statusCode === 404) return null
        throw error
      }
    )
  }

  /**
   * Builds the URL for a plugin marker POM file.
   *
   * @private
   * @param {GradleCoordinates} coordinates - The coordinates containing name and revision
   * @returns {string} The complete URL to the marker POM file
   */
  _buildPomUrl(coordinates) {
    const { pluginBaseUrl, plugin } = this._buildPluginInfo(coordinates)
    return `${pluginBaseUrl}/${coordinates.revision}/${plugin}-${coordinates.revision}.pom`
  }

  /**
   * Handles HTTP requests using the configured fetch function.
   *
   * @private
   * @param {string} url - The URL to request
   * @returns {Promise<string | FetchResponse>} Promise that resolves to the response body as string
   * @throws {Error} When request fails
   */
  async _handleRequest(url) {
    return await requestPromise({ url, method: 'GET', json: false })
  }

  /**
   * Builds plugin information including base URL and plugin name.
   *
   * @private
   * @param {{ name: string }} coordinates - Object containing the plugin name
   * @returns {GradlePluginInfo} Object with plugin base URL and full plugin name
   */
  _buildPluginInfo({ name }) {
    const path = `${name.replace(/\./g, '/')}`
    const plugin = `${name}.gradle.plugin`
    const pluginBaseUrl = `${repoBaseUrl}/${path}/${plugin}`
    return { pluginBaseUrl, plugin }
  }

  /**
   * Gets Maven metadata XML for a plugin.
   *
   * @param {string} pluginId - The ID of the plugin
   * @returns {Promise<string | FetchResponse | null>} Promise that resolves to the metadata XML string, or null if not
   *   found
   * @throws {Error} When metadata request fails with non-404 errors
   */
  async getMavenMetadata(pluginId) {
    const { pluginBaseUrl } = this._buildPluginInfo({ name: pluginId })
    const url = `${pluginBaseUrl}/maven-metadata.xml`
    return await this._request(url)
  }
}

module.exports = GradleCoordinatesMapper
