// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinatesSpec } from './entityCoordinates.ts'
import type { FetchResponse } from './fetch.ts'
import { promisify } from 'node:util'
import xml2js from 'xml2js'
import { callFetch as requestPromise } from '../lib/fetch.ts'

const parseXml = promisify(xml2js.parseString)

import lodash from 'lodash'

const { get } = lodash

import EntityCoordinates from './entityCoordinates.ts'

/** Coordinates specific to Gradle plugin resolution */
export interface GradleCoordinates extends EntityCoordinatesSpec {
  name: string
  namespace?: string
  revision?: string
}

/** Result of Gradle plugin coordinate resolution */
export interface GradleResolutionResult {
  namespace?: string
  name?: string
  revision?: string
}

/** Information about Gradle plugin structure */
export interface GradlePluginInfo {
  pluginBaseUrl: string
  plugin: string
}

/** Base URL for Gradle Plugin Portal Maven repository */
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
export class GradleCoordinatesMapper {
  /**
   * Maps Gradle plugin coordinates to their underlying Maven coordinates.
   */
  async map(coordinates: GradleCoordinates): Promise<EntityCoordinates | null> {
    if (!this._shouldResolve(coordinates)) {
      return null
    }
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  /**
   * Determines if the given coordinates should be resolved.
   */
  _shouldResolve(coordinates: GradleCoordinates): boolean {
    return !coordinates.namespace && !!coordinates.name
  }

  /**
   * Resolves coordinates by fetching the plugin marker and extracting Maven coordinates.
   */
  async _resolve(coordinates: GradleCoordinates): Promise<GradleResolutionResult | null> {
    const markerCoordinates = coordinates.revision
      ? coordinates
      : { ...coordinates, revision: await this._getLatestVersion(coordinates) }
    if (!markerCoordinates.revision) {
      return null
    }

    const mappedGav = await this._getImplementation(markerCoordinates)
    return (
      mappedGav && {
        namespace: get(mappedGav, 'groupId.0') as string,
        name: get(mappedGav, 'artifactId.0') as string,
        revision: coordinates.revision ? (get(mappedGav, 'version.0') as string) : undefined
      }
    )
  }

  /**
   * Gets the latest version of a plugin from its Maven metadata.
   */
  async _getLatestVersion({ name }: { name: string }): Promise<string | undefined> {
    const answer = await this.getMavenMetadata(name)
    const meta = answer && (await parseXml(answer))
    return get(meta, 'metadata.versioning.0.release.0')
  }

  /**
   * Gets the Maven coordinates from a plugin marker POM.
   */
  async _getImplementation(markerCoordinates: GradleCoordinates): Promise<any | null> {
    const answer = await this._request(this._buildPomUrl(markerCoordinates))
    const pluginMarker = answer && (await parseXml(answer))
    return get(pluginMarker, 'project.dependencies.0.dependency.0')
  }

  /**
   * Makes a request and handles 404 errors gracefully.
   */
  async _request(url: string): Promise<string | FetchResponse<string> | null> {
    return this._handleRequest(url).catch(
      (error): string | FetchResponse<string> | null => {
        if (error.statusCode === 404) {
          return null
        }
        throw error
      }
    )
  }

  /**
   * Builds the URL for a plugin marker POM file.
   */
  _buildPomUrl(coordinates: GradleCoordinates): string {
    const { pluginBaseUrl, plugin } = this._buildPluginInfo(coordinates)
    return `${pluginBaseUrl}/${coordinates.revision}/${plugin}-${coordinates.revision}.pom`
  }

  /**
   * Handles HTTP requests using the configured fetch function.
   */
  async _handleRequest(url: string): Promise<string> {
    return await requestPromise({ url, method: 'GET', json: false }) as string
  }

  /**
   * Builds plugin information including base URL and plugin name.
   */
  _buildPluginInfo({ name }: { name: string }): GradlePluginInfo {
    const path = `${name.replace(/\./g, '/')}`
    const plugin = `${name}.gradle.plugin`
    const pluginBaseUrl = `${repoBaseUrl}/${path}/${plugin}`
    return { pluginBaseUrl, plugin }
  }

  /**
   * Gets Maven metadata XML for a plugin.
   */
  async getMavenMetadata(pluginId: string): Promise<string | FetchResponse<string> | null> {
    const { pluginBaseUrl } = this._buildPluginInfo({ name: pluginId })
    const url = `${pluginBaseUrl}/maven-metadata.xml`
    return await this._request(url)
  }
}

export default GradleCoordinatesMapper
