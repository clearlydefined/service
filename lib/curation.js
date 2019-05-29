// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const yaml = require('js-yaml')
const validator = require('../schemas/validator')
const EntityCoordinates = require('./entityCoordinates')
const utils = require('./utils')

class Curation {
  constructor(content, path = '', validate = true) {
    this.errors = []
    this.isValid = false
    this.path = path
    this.data = typeof content === 'string' ? this.load(content) : content
    this.shouldValidate = validate
    if (validate) this.validate()
  }

  static apply(definition, curation) {
    utils.mergeDefinitions(definition, curation, true)
    return definition
  }

  static getAllCoordinates(curations) {
    return curations.reduce((list, curation) => list.concat(curation.getCoordinates()), [])
  }

  load(content) {
    try {
      return yaml.safeLoad(content)
    } catch (error) {
      this.errors.push({ message: 'Invalid yaml', error })
    }
  }

  validate() {
    this.isValid = validator.validate('curations', this.data)
    if (!this.isValid) this.errors.push(...validator.errors.map(error => ({ message: 'Invalid curation', error })))
  }

  getCoordinates() {
    const c = this.data.coordinates
    if (!c) return []
    return Object.getOwnPropertyNames(this.data.revisions).map(
      key => new EntityCoordinates(c.type, c.provider, c.namespace, c.name, key)
    )
  }
}

module.exports = Curation
