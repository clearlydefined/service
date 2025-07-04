// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates, EntityCoordinatesSpec } from './entityCoordinates'
import { FetchFunction, FetchResponse } from './fetch'

/** Coordinates specific to Gradle plugin resolution */
export interface GradleCoordinates extends EntityCoordinatesSpec {
  /** The name of the Gradle plugin */
  name: string
  /** Optional namespace (should be empty for resolution to occur) */
  namespace?: string
  /** Optional revision/version of the plugin */
  revision?: string
}

/** Result of Gradle plugin coordinate resolution */
export interface GradleResolutionResult {
  /** The resolved namespace (Maven groupId) */
  namespace?: string
  /** The resolved name (Maven artifactId) */
  name?: string
  /** The resolved revision (Maven version) */
  revision?: string
}

/** Information about Gradle plugin structure */
export interface GradlePluginInfo {
  /** Base URL for the plugin in the repository */
  pluginBaseUrl: string
  /** Full plugin name with gradle.plugin suffix */
  plugin: string
}

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
export declare class GradleCoordinatesMapper {
  /**
   * Maps Gradle plugin coordinates to their underlying Maven coordinates.
   *
   * This method resolves Gradle plugin coordinates by:
   *
   * 1. Checking if resolution is needed (no namespace and has name)
   * 2. Finding the latest version if no revision is provided
   * 3. Fetching the plugin marker POM to get the actual Maven coordinates
   *
   * @param coordinates - The Gradle plugin coordinates to map
   * @returns Promise that resolves to EntityCoordinates with Maven coordinates, or null if not resolvable
   * @throws {Error} When repository requests fail with non-404 errors
   */
  map(coordinates: GradleCoordinates): Promise<EntityCoordinates | null>

  /**
   * Determines if the given coordinates should be resolved.
   *
   * Resolution is needed when there's no namespace but there is a name, indicating this is a Gradle plugin that needs
   * to be mapped to its Maven coordinates.
   *
   * @param coordinates - The coordinates to check
   * @returns True if the coordinates should be resolved, false otherwise
   */
  private _shouldResolve(coordinates: GradleCoordinates): boolean

  /**
   * Resolves coordinates by fetching the plugin marker and extracting Maven coordinates.
   *
   * @param coordinates - The coordinates to resolve
   * @returns Promise that resolves to resolution result with Maven coordinates, or null if not found
   * @throws {Error} When repository requests fail with non-404 errors
   */
  private _resolve(coordinates: GradleCoordinates): Promise<GradleResolutionResult | null>

  /**
   * Gets the latest version of a plugin from its Maven metadata.
   *
   * @param coordinates - Object containing the plugin name
   * @returns Promise that resolves to the latest version string, or undefined if not found
   * @throws {Error} When metadata request fails with non-404 errors
   */
  private _getLatestVersion(coordinates: { name: string }): Promise<string | undefined>

  /**
   * Gets the Maven coordinates from a plugin marker POM.
   *
   * The marker POM contains a dependency that points to the actual plugin implementation. This method extracts the
   * groupId, artifactId, and version from that dependency.
   *
   * @param markerCoordinates - The marker coordinates including name and revision
   * @returns Promise that resolves to the first dependency from the marker POM, or null if not found
   * @throws {Error} When POM request fails with non-404 errors
   */
  private _getImplementation(markerCoordinates: GradleCoordinates): Promise<any | null>

  /**
   * Makes a request and handles 404 errors gracefully.
   *
   * @param url - The URL to request
   * @returns Promise that resolves to the response body, or null if 404
   * @throws {Error} When request fails with non-404 errors
   */
  private _request(url: string): Promise<string | FetchResponse<string> | null>

  /**
   * Builds the URL for a plugin marker POM file.
   *
   * @param coordinates - The coordinates containing name and revision
   * @returns The complete URL to the marker POM file
   */
  private _buildPomUrl(coordinates: GradleCoordinates): string

  /**
   * Handles HTTP requests using the configured fetch function.
   *
   * @param url - The URL to request
   * @returns Promise that resolves to the response body as string
   * @throws {Error} When request fails
   */
  private _handleRequest(url: string): Promise<string>

  /**
   * Builds plugin information including base URL and plugin name.
   *
   * @param coordinates - Object containing the plugin name
   * @returns Object with plugin base URL and full plugin name
   */
  private _buildPluginInfo(coordinates: { name: string }): GradlePluginInfo

  /**
   * Gets Maven metadata XML for a plugin.
   *
   * @param pluginId - The ID of the plugin
   * @returns Promise that resolves to the metadata XML string, or null if not found
   * @throws {Error} When metadata request fails with non-404 errors
   */
  getMavenMetadata(pluginId: string): Promise<string | FetchResponse<string> | null>
}

export default GradleCoordinatesMapper
