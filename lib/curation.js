// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./curation').CurationData} CurationData */
/** @typedef {import('./curation').CurationRevision} CurationRevision */
/** @typedef {import('./curation').CurationError} CurationError */
/** @typedef {import('./utils').Definition} Definition */

const SPDX = require('@clearlydefined/spdx')
const yaml = require('js-yaml')
const validator = require('../schemas/validator')
const EntityCoordinates = require('./entityCoordinates')
const utils = require('./utils')

/**
 * Represents a curation document that can be applied to definitions
 */
class Curation {
  /**
   * Creates a new Curation instance
   * @param {string | CurationData} content - YAML string or parsed curation data object
   * @param {string} [path] - Optional file path for error reporting
   * @param {boolean} [validate] - Whether to validate the curation (default: true)
   */
  constructor(content, path = '', validate = true) {
    /** @type {CurationError[]} */
    this.errors = []
    /** @type {boolean} */
    this.isValid = false
    /** @type {string} */
    this.path = path
    /** @type {CurationData | undefined} */
    this.data = typeof content === 'string' ? this.load(content) : content
    /** @type {boolean} */
    this.shouldValidate = validate
    if (validate) this.validate()
  }

  /**
   * Applies a curation to a definition
   * @param {Definition} definition - The definition to modify
   * @param {CurationRevision} curation - The curation revision data to apply
   * @returns {Definition} The modified definition
   */
  static apply(definition, curation) {
    utils.mergeDefinitions(definition, curation, true)
    return definition
  }

  /**
   * Gets all coordinates from multiple curations
   * @param {Curation[]} curations - Array of Curation instances
   * @returns {EntityCoordinates[]} Array of all EntityCoordinates from all curations
   */
  static getAllCoordinates(curations) {
    return curations.reduce(
      /**
       * @param {EntityCoordinates[]} list
       * @param {Curation} curation
       */
      (list, curation) => list.concat(curation.getCoordinates()),
      []
    )
  }

  /**
   * Loads YAML content into curation data
   * @param {string} content - YAML string to parse
   * @returns {CurationData | undefined} Parsed curation data or undefined on error
   */
  load(content) {
    try {
      return yaml.load(content)
    } catch (error) {
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
      this.errors.push(...validator.errors.map(error => ({ message: 'Invalid curation', error })))
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
    // @ts-ignore - data.revisions accessed after validation
    const revisions = this.data.revisions
    /** @type {{source: string, license: string}[]} */
    const sourceLicenseList = []
    /** @type {string[]} */
    const errors = []

    Object.keys(revisions)
      .filter(revision => revisions[revision].licensed)
      .forEach(revision =>
        sourceLicenseList.push({
          source: `${revision} licensed.declared`,
          license: revisions[revision].licensed.declared
        })
      )

    Object.keys(revisions)
      .filter(revision => revisions[revision].files)
      .forEach(revision => {
        revisions[revision].files.forEach(
          /** @param {import('./curation').CurationFileEntry} file */ file => {
            if (file.license) {
              sourceLicenseList.push({
                source: `${file.path} in ${revision} files`,
                license: file.license
              })
            }
          }
        )
      })

    sourceLicenseList.forEach(({ source, license }) => {
      const parsed = SPDX.normalize(license)
      if (!parsed || parsed.includes('NOASSERTION')) {
        errors.push(`${source} with value "${license}" is not SPDX compliant`)
      } else if (parsed !== license) {
        errors.push(`${source} with value "${license}" is not normalized. Suggest using "${parsed}"`)
      }
    })

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
    const c = this.data.coordinates
    if (!c) return []
    return Object.getOwnPropertyNames(this.data.revisions).map(
      key => new EntityCoordinates(c.type, c.provider, c.namespace, c.name, key)
    )
  }
}

module.exports = Curation
