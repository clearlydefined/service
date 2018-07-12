// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const yaml = require('js-yaml')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true })
const curationSchema = require('../schemas/curation')
const EntityCoordinates = require('./entityCoordinates')

class Curation {
  constructor(content, path = '') {
    this.errors = []
    this.isValid = false
    this.path = path
    this.data = content

    if (typeof content === 'string') {
      this.load(content)
    }
    return this.validate()
  }

  load(content) {
    try {
      this.data = yaml.safeLoad(content)
    } catch (error) {
      this.errors.push({
        message: 'Invalid yaml',
        error
      })
    }
  }

  validate() {
    this.isValid = ajv.validate(curationSchema, this.data)
    if (!this.isValid) {
      this.errors.push(...ajv.errors.map(error => ({ message: 'Invalid curation', error })))
    }
  }

  getCoordinates() {
    const c = this.data.coordinates
    return Object.getOwnPropertyNames(this.data.revisions).map(
      key => new EntityCoordinates(c.type, c.provider, c.namespace, c.name, key)
    )
  }
}

module.exports = Curation
