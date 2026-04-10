// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SPDX from '@clearlydefined/spdx'
import yaml from 'js-yaml'
import validator from '../schemas/validator.js'
import EntityCoordinates from './entityCoordinates.ts'
import type { Definition } from './utils.ts'
import * as utils from './utils.ts'

/** Error entry from curation validation */
export interface CurationError {
  message: string
  error: unknown
}

/** Coordinates section of curation data */
export interface CurationCoordinates {
  type?: string
  provider?: string
  namespace?: string
  name?: string
}

/** File-level curation data */
export interface CurationFileEntry {
  path: string
  license?: string
  attributions?: string[]
}

/** Revision-level curation data */
export interface CurationRevision {
  licensed?: {
    declared?: string
  }
  described?: {
    releaseDate?: string
    projectWebsite?: string
    facets?: Record<string, string[]>
    sourceLocation?: {
      type?: string
      provider?: string
      namespace?: string
      name?: string
      revision?: string
      url?: string
    }
  }
  files?: CurationFileEntry[]
}

/** Full curation data structure */
export interface CurationData {
  coordinates?: CurationCoordinates
  revisions?: Record<string, CurationRevision>
}

/**
 * Represents a curation document that can be applied to definitions
 */
class Curation {
  errors: CurationError[]
  isValid: boolean
  path: string
  data: CurationData | undefined
  shouldValidate: boolean

  /**
   * Creates a new Curation instance
   */
  constructor(content?: string | CurationData, path: string = '', validate: boolean = true) {
    this.errors = []
    this.isValid = false
    this.path = path
    this.data = typeof content === 'string' ? this.load(content) : content
    this.shouldValidate = validate
    if (validate) {
      this.validate()
    }
  }

  /**
   * Applies a curation to a definition
   */
  static apply(definition: Definition, curation: CurationRevision): Definition {
    utils.mergeDefinitions(definition, curation, true)
    return definition
  }

  /**
   * Gets all coordinates from multiple curations
   */
  static getAllCoordinates(curations: Curation[]): EntityCoordinates[] {
    return curations.reduce(
      (list: EntityCoordinates[], curation: Curation) => list.concat(curation.getCoordinates()),
      []
    )
  }

  /**
   * Loads YAML content into curation data
   */
  load(content: string): CurationData | undefined {
    try {
      return yaml.load(content) as CurationData | undefined
    } catch (error: any) {
      this.errors.push({ message: 'Invalid yaml', error })
      return undefined
    }
  }

  /**
   * Validates the curation data against schema and SPDX compliance
   */
  validate() {
    this.isValid = validator.validate('curations', this.data)
    if (!this.isValid) {
      this.errors.push(...validator.errors.map((error: unknown) => ({ message: 'Invalid curation', error })))
      return
    }

    const { isCompliant, errors } = this._validateSpdxCompliance()
    this.isValid = isCompliant
    if (!this.isValid) {
      this.errors.push(...errors.map(error => ({ message: 'Invalid license in curation', error })))
    }
  }

  /**
   * Validates SPDX compliance of all licenses in the curation
   * @returns {{isCompliant: boolean, errors: string[]}}
   * @private
   */
  _validateSpdxCompliance() {
    const revisions = this.data!.revisions!
    const sourceLicenseList: { source: string; license: string }[] = []
    const errors: string[] = []

    for (const revision of Object.keys(revisions).filter(revision => revisions[revision]!.licensed)) {
      sourceLicenseList.push({
        source: `${revision} licensed.declared`,
        license: revisions[revision]!.licensed!.declared!
      })
    }

    for (const revision of Object.keys(revisions).filter(revision => revisions[revision]!.files)) {
      for (const file of revisions[revision]!.files as CurationFileEntry[]) {
        if (file.license) {
          sourceLicenseList.push({
            source: `${file.path} in ${revision} files`,
            license: file.license
          })
        }
      }
    }

    for (const { source, license } of sourceLicenseList) {
      const parsed = SPDX.normalize(license)
      if (!parsed || parsed.includes('NOASSERTION')) {
        errors.push(`${source} with value "${license}" is not SPDX compliant`)
      } else if (parsed !== license) {
        errors.push(`${source} with value "${license}" is not normalized. Suggest using "${parsed}"`)
      }
    }

    return {
      isCompliant: errors.length === 0,
      errors
    }
  }

  /**
   * Gets EntityCoordinates for all revisions in this curation
   * @returns {EntityCoordinates[]} Array of EntityCoordinates, one per revision
   */
  getCoordinates() {
    const c = this.data!.coordinates
    if (!c) {
      return []
    }
    return Object.getOwnPropertyNames(this.data!.revisions).map(
      key => new EntityCoordinates(c.type, c.provider, c.namespace, c.name, key)
    )
  }
}

export default Curation
