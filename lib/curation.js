// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const SPDX = require('@clearlydefined/spdx')
const yaml = require('js-yaml')
const validator = require('../schemas/validator')
const EntityCoordinates = require('./entityCoordinates')
const utils = require('./utils')

class Curation {
  /**
   * 
   * @param {string|any} content 
   * @param {string} path 
   * @param {boolean} validate 
   */
  constructor(content, path = '', validate = true) {
    /**
     * @type {{ message: string; error: any; }[]}
     */
    this.errors = []
    this.isValid = false
    this.path = path
    this.data = typeof content === 'string' ? this.load(content) : content
    this.shouldValidate = validate
    if (validate) this.validate()
  }

  /**
   * 
   * @param {any} definition 
   * @param {any} curation 
   * @returns {any}
   */
  static apply(definition, curation) {
    utils.mergeDefinitions(definition, curation, true)
    return definition
  }

  /**
   * 
   * @param {any[]} curations 
   * @returns {any[]}
   */
  static getAllCoordinates(curations) {
    return curations.reduce((list, curation) => list.concat(curation.getCoordinates()), [])
  }

  /**
   * 
   * @param {string} content 
   * @returns {any|void}
   */
  load(content) {
    try {
      return yaml.safeLoad(content)
    } catch (error) {
      this.errors.push({ message: 'Invalid yaml', error })
      return
    }
  }

  /**
   * 
   * @returns {void}
   */
  validate() {
    // @ts-ignore
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
   * 
   * @returns {{isCompliant: boolean, errors: any[]}}
   */
  _validateSpdxCompliance() {
    const revisions = this.data.revisions
    /**
     * @type {{ source: string; license: any; }[]}
     */
    const sourceLicenseList = []
    /**
     * @type {string[]}
     */
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
        revisions[revision].files.forEach((/** @type {{ license: any; path: any; }} */ file) => {
          if (file.license) {
            sourceLicenseList.push({
              source: `${file.path} in ${revision} files`,
              license: file.license
            })
          }
        })
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
   * 
   * @returns {EntityCoordinates[]}
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
