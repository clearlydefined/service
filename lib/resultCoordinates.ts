// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinatesSpec } from './entityCoordinates.ts'
import EntityCoordinates from './entityCoordinates.ts'

/** Represents the specification object used to create ResultCoordinates */
export interface ResultCoordinatesSpec extends EntityCoordinatesSpec {
  tool?: string
  toolVersion?: string
}

/** Represents result coordinates for a software component with associated tool information */
export class ResultCoordinates {
  /** The type of the entity (e.g., 'npm', 'maven', 'git') */
  type?: string
  /** The provider of the entity (e.g., 'npmjs', 'mavencentral', 'github') */
  provider?: string
  /** The namespace of the entity (optional, depends on provider) */
  namespace?: string
  /** The name of the entity */
  name?: string
  /** The revision/version of the entity */
  revision?: string
  /** The tool used to analyze the entity (e.g., 'clearlydefined', 'scancode') */
  tool?: string
  /** The version of the tool used to analyze the entity */
  toolVersion?: string

  /**
   * Creates ResultCoordinates from a specification object
   */
  static fromObject(spec: ResultCoordinatesSpec | ResultCoordinates | null | undefined): ResultCoordinates | null {
    if (!spec) {
      return null
    }
    if (spec.constructor === ResultCoordinates) {
      return spec
    }
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
   */
  static fromString(path: string | null | undefined): ResultCoordinates | null {
    if (!path) {
      return null
    }
    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespaceSpec, name, revision, tool, toolVersion] = path.split('/')
    const namespace = namespaceSpec === '-' ? null : namespaceSpec
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  /**
   * Creates ResultCoordinates from a URN string
   */
  static fromUrn(urn: string | null | undefined): ResultCoordinates | null {
    if (!urn) {
      return null
    }
    const [, type, provider, namespace, name, , revision, , tool, toolVersion] = urn.split(':')
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  /**
   * Creates a new ResultCoordinates instance
   */
  constructor(
    type?: string,
    provider?: string,
    namespace?: string | null,
    name?: string,
    revision?: string,
    tool?: string,
    toolVersion?: string
  ) {
    const entity = new EntityCoordinates(type, provider, namespace, name, revision)
    this.type = entity.type
    this.provider = entity.provider
    if (entity.namespace) {
      this.namespace = entity.namespace
    }
    this.name = entity.name
    this.revision = entity.revision
    this.tool = tool?.toLowerCase()
    this.toolVersion = toolVersion
  }

  /**
   * Converts the coordinates to a string representation
   */
  toString(): string {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision, this.tool, this.toolVersion]
      .filter(s => s)
      .join('/')
  }

  /**
   * Converts the result coordinates to entity coordinates (without tool information)
   */
  asEntityCoordinates(): EntityCoordinates {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name, this.revision)
  }
}

export default ResultCoordinates
