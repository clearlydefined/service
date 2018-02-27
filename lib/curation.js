// Copyright (c) 2017, The Linux Foundation.
// SPDX-License-Identifier: MIT

const yaml = require('js-yaml');
const Ajv = require('ajv');
const ajv = new Ajv();
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
const curationSchema = require('../schemas/curation');
const EntityCoordinates = require('./entityCoordinates');

class Curation {
  constructor(content, data = null, path = '') {
    this.errors = [];
    this.data = data;
    this.isValid = false;
    this.path = path;

    if (content) {
      this.load(content);
    }
    if (this.data) {
      this.validate();
    }
  }

  load(content) {
    try {
      this.data = yaml.safeLoad(content);
    } catch (error) {
      this.errors.push({
        message: 'Invalid yaml',
        error
      });
    }
  }

  validate() {
    this.isValid = ajv.validate(curationSchema, this.data);
    if (!this.isValid) {
      this.errors.push(...ajv.errors.map(error => ({message: 'Invalid curation', error})));
    }
  }

  getCoordinates() {
    const c = this.data.coordinates;
    return Object.getOwnPropertyNames(this.data.revisions).map(key =>
      new EntityCoordinates(c.type, c.provider, c.namespace, c.name, key));
  }
}

module.exports = Curation;
