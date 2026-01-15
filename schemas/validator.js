// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Ajv = require('ajv').default
const ajvErrors = require('ajv-errors')
const addFormats = require('ajv-formats')
const config = require('painless-config')

const restDebug = process.env.ENABLE_REST_VALIDATION_ERRORS || config.get('ENABLE_REST_VALIDATION_ERRORS')
const allErrorsEnabled = restDebug === 'true'

const ajvOptions = {
  allErrors: allErrorsEnabled,
  strict: 'log',
  useDefaults: true,
  maxItems: 1000,
  maxProperties: 100,
  maxLength: 10000,
  maxErrors: 10
}

const ajv = new Ajv(ajvOptions)

// Add formats and error messages support
addFormats(ajv)
if (allErrorsEnabled) {
  ajvErrors(ajv)
}

// Register JSON schemas
ajv.addSchema(require('./curations-1.0'), 'curations')
ajv.addSchema(require('./curation-1.0'), 'curation')
ajv.addSchema(require('./definition-1.0'), 'definition')
ajv.addSchema(require('./harvest-1.0'), 'harvest')
ajv.addSchema(require('./notice-request'), 'notice-request')
ajv.addSchema(require('./definitions-find'), 'definitions-find')
ajv.addSchema(require('./definitions-get-dto-1.0'), 'definitions-get-dto')
ajv.addSchema(require('./coordinates-1.0'), 'coordinates-1.0')
ajv.addSchema(require('./versionless-coordinates-1.0'), 'versionless-coordinates-1.0')

module.exports = ajv
