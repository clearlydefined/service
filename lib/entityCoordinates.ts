// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** Represents the specification object used to create EntityCoordinates */
export interface EntityCoordinatesSpec {
  type?: string
  provider?: string
  namespace?: string
  name?: string
  revision?: string
}

/** Property flag for namespace normalization */
const NAMESPACE = 0x4
/** Property flag for name normalization */
const NAME = 0x2
/** Property flag for revision normalization */
const REVISION = 0x1

/**
 * Map of providers to their normalization rules using bitwise flags
 */
const toLowerCaseMap: Record<string, number> = {
  github: NAMESPACE | NAME,
  pypi: NAME,
  clojars: NAMESPACE | NAME
}

/**
 * Normalizes a value based on provider-specific rules
 */
function normalize(value: string | undefined, provider: string | undefined, property: number): string | undefined {
  if (!value) {
    return value
  }
  const mask = toLowerCaseMap[provider!] || 0
  return mask & property ? value.toLowerCase() : value
}

/** Represents entity coordinates for a software component */
export class EntityCoordinates implements EntityCoordinatesSpec {
  declare type?: string
  declare provider?: string
  declare namespace?: string
  declare name?: string
  declare revision?: string

  /**
   * Creates EntityCoordinates from a specification object
   */
  static fromObject(spec: EntityCoordinatesSpec | EntityCoordinates | null | undefined): EntityCoordinates | null {
    if (!spec) {
      return null
    }
    if (spec.constructor === EntityCoordinates) {
      return spec
    }
    return new EntityCoordinates(spec.type, spec.provider, spec.namespace, spec.name, spec.revision)
  }

  /**
   * Creates EntityCoordinates from a path string
   */
  static fromString(path: string | null | undefined): EntityCoordinates | null {
    if (!path || typeof path !== 'string') {
      return null
    }

    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespace, name, revision] = path.split('/')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  /**
   * Creates EntityCoordinates from a URN string
   */
  static fromUrn(urn: string | null | undefined): EntityCoordinates | null {
    if (!urn) {
      return null
    }
    const [, type, provider, namespace, name, , revision] = urn.split(':')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  /**
   * Creates a new EntityCoordinates instance
   */
  constructor(type?: string, provider?: string, namespace?: string | null, name?: string, revision?: string) {
    this.type = type?.toLowerCase()
    this.provider = provider?.toLowerCase()
    if (namespace && namespace !== '-') {
      this.namespace = normalize(namespace, this.provider, NAMESPACE)
    }
    this.name = normalize(name, this.provider, NAME)
    const normalizedRevision = normalize(revision, this.provider, REVISION)
    if (normalizedRevision) {
      this.revision = normalizedRevision
    }
  }

  /**
   * Converts the coordinates to a string representation
   */
  toString(): string {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision].filter(s => s).join('/')
  }

  /**
   * Creates a copy of the coordinates without the revision
   */
  asRevisionless(): EntityCoordinates {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name)
  }

  /**
   * Returns this instance (identity function for compatibility)
   */
  asEntityCoordinates(): EntityCoordinates {
    return this
  }
}

export default EntityCoordinates
