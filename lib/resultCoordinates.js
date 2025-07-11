// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./resultCoordinates').ResultCoordinatesSpec} ResultCoordinatesSpec */

const EntityCoordinates = require('./entityCoordinates')

/** Represents result coordinates for a software component with associated tool information */
class ResultCoordinates {
  /**
   * Creates ResultCoordinates from a specification object
   *
   * @param {ResultCoordinatesSpec | ResultCoordinates | null | undefined} spec - The specification object or existing
   *   ResultCoordinates instance
   * @returns {ResultCoordinates | null} New ResultCoordinates instance or null if spec is falsy
   */
  static fromObject(spec) {
    if (!spec) return null
    if (spec.constructor === ResultCoordinates) return spec
    return new ResultCoordinates(
      spec.type,
      spec.provider,
      spec.namespace,
      spec.name,
      spec.revision,
      spec.tool,
      spec.toolVersion
    )
  }

  /**
   * Creates ResultCoordinates from a path string
   *
   * @param {string | null | undefined} path - Path string in format
   *   "type/provider/namespace/name/revision/tool/toolVersion"
   * @returns {ResultCoordinates | null} New ResultCoordinates instance or null if path is invalid
   */
  static fromString(path) {
    if (!path) return null
    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespaceSpec, name, revision, tool, toolVersion] = path.split('/')
    const namespace = namespaceSpec === '-' ? null : namespaceSpec
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  /**
   * Creates ResultCoordinates from a URN string
   *
   * @param {string | null | undefined} urn - URN string in format
   *   "scheme:type:provider:namespace:name:revision:revision:tool:tool:toolVersion"
   * @returns {ResultCoordinates | null} New ResultCoordinates instance or null if urn is invalid
   */
  static fromUrn(urn) {
    if (!urn) return null
    const [, type, provider, namespace, name, , revision, , tool, toolVersion] = urn.split(':')
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  /**
   * Creates a new ResultCoordinates instance
   *
   * @param {string} [type] - The type of the entity (e.g., 'npm', 'maven', 'git')
   * @param {string} [provider] - The provider of the entity (e.g., 'npmjs', 'mavencentral', 'github')
   * @param {string} [namespace] - The namespace of the entity (optional, depends on provider)
   * @param {string} [name] - The name of the entity
   * @param {string} [revision] - The revision/version of the entity
   * @param {string} [tool] - The tool used to analyze the entity (e.g., 'clearlydefined', 'scancode')
   * @param {string} [toolVersion] - The version of the tool used to analyze the entity
   */
  constructor(type, provider, namespace, name, revision, tool, toolVersion) {
    const entity = new EntityCoordinates(type, provider, namespace, name, revision)
    /** @type {string | undefined} The Type of the entity */
    this.type = entity.type
    /** @type {string | undefined} The Provider of the entity */
    this.provider = entity.provider
    /** @type {string | undefined} The Namespace of the entity */
    if (entity.namespace) this.namespace = entity.namespace
    /** @type {string | undefined} The Name of the entity */
    this.name = entity.name
    /** @type {string | undefined} The Revision/version of the entity */
    this.revision = entity.revision
    /** @type {string | undefined} The Tool used to analyze the entity */
    this.tool = tool && tool.toLowerCase()
    /** @type {string | undefined} The Version of the tool used to analyze the entity */
    this.toolVersion = toolVersion
  }

  /**
   * Converts the coordinates to a string representation
   *
   * @returns {string} String representation in format "type/provider/namespace/name/revision/tool/toolVersion"
   */
  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision, this.tool, this.toolVersion]
      .filter(s => s)
      .join('/')
  }

  /**
   * Converts the result coordinates to entity coordinates (without tool information)
   *
   * @returns {EntityCoordinates} New EntityCoordinates instance representing the same entity
   */
  asEntityCoordinates() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name, this.revision)
  }
}

module.exports = ResultCoordinates
