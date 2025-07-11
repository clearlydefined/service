// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./entityCoordinates').EntityCoordinatesSpec} EntityCoordinatesSpec */

/** Property flag for namespace normalization */
const NAMESPACE = 0x4
/** Property flag for name normalization */
const NAME = 0x2
/** Property flag for revision normalization */
const REVISION = 0x1

/**
 * Map of providers to their normalization rules using bitwise flags
 *
 * @type {Object<string, number>}
 */
const toLowerCaseMap = {
  github: NAMESPACE | NAME,
  pypi: NAME
}

/**
 * Normalizes a value based on provider-specific rules
 *
 * @param {string | undefined} value - The value to normalize
 * @param {string} provider - The provider name
 * @param {number} property - The property flag to check against
 * @returns {string | undefined} The normalized value or the original value if no normalization is needed
 */
function normalize(value, provider, property) {
  if (!value) return value
  const mask = toLowerCaseMap[provider] || 0
  return mask & property ? value.toLowerCase() : value
}

/** Represents entity coordinates for a software component */
class EntityCoordinates {
  /**
   * Creates EntityCoordinates from a specification object
   *
   * @param {EntityCoordinatesSpec | EntityCoordinates | null | undefined} spec - The specification object or existing
   *   EntityCoordinates instance
   * @returns {EntityCoordinates | null} New EntityCoordinates instance or null if spec is falsy
   */
  static fromObject(spec) {
    if (!spec) return null
    if (spec.constructor === EntityCoordinates) return spec
    return new EntityCoordinates(spec.type, spec.provider, spec.namespace, spec.name, spec.revision)
  }

  /**
   * Creates EntityCoordinates from a path string
   *
   * @param {string | null | undefined} path - Path string in format "type/provider/namespace/name/revision"
   * @returns {EntityCoordinates | null} New EntityCoordinates instance or null if path is invalid
   */
  static fromString(path) {
    if (!path || typeof path !== 'string') return null

    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespace, name, revision] = path.split('/')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  /**
   * Creates EntityCoordinates from a URN string
   *
   * @param {string | null | undefined} urn - URN string in format "scheme:type:provider:namespace:name:rev:revision"
   * @returns {EntityCoordinates | null} New EntityCoordinates instance or null if urn is invalid
   */
  static fromUrn(urn) {
    if (!urn) return null
    const [, type, provider, namespace, name, , revision] = urn.split(':')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  /**
   * Creates a new EntityCoordinates instance
   *
   * @param {string} [type] - The type of the entity (e.g., 'npm', 'maven', 'git')
   * @param {string} [provider] - The provider of the entity (e.g., 'npmjs', 'mavencentral', 'github')
   * @param {string} [namespace] - The namespace of the entity (optional, depends on provider)
   * @param {string} [name] - The name of the entity
   * @param {string} [revision] - The revision/version of the entity (optional)
   */
  constructor(type, provider, namespace, name, revision) {
    /** @type {string | undefined} The Type of the entity */
    this.type = type && type.toLowerCase()
    /** @type {string | undefined} The Provider of the entity */
    this.provider = provider && provider.toLowerCase()
    /** @type {string | undefined} The Namespace of the entity */
    if (namespace && namespace !== '-') this.namespace = normalize(namespace, this.provider, NAMESPACE)
    /** @type {string | undefined} The Name of the entity */
    this.name = normalize(name, this.provider, NAME)
    const normalizedRevision = normalize(revision, this.provider, REVISION)
    /** @type {string | undefined} The Revision/version of the entity */
    if (normalizedRevision) this.revision = normalizedRevision
  }

  /**
   * Converts the coordinates to a string representation
   *
   * @returns {string} String representation in format "type/provider/namespace/name/revision"
   */
  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision].filter(s => s).join('/')
  }

  /**
   * Creates a copy of the coordinates without the revision
   *
   * @returns {EntityCoordinates} New EntityCoordinates instance without revision
   */
  asRevisionless() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name)
  }

  /**
   * Returns this instance (identity function for compatibility)
   *
   * @returns {EntityCoordinates} This EntityCoordinates instance
   */
  asEntityCoordinates() {
    return this
  }
}

module.exports = EntityCoordinates
