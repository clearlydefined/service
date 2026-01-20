// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Ajv = require('ajv').default
const ajvErrors = require('ajv-errors').default
const addFormats = require('ajv-formats').default
const config = require('painless-config')

const restDebug = process.env['ENABLE_REST_VALIDATION_ERRORS'] || config.get('ENABLE_REST_VALIDATION_ERRORS')
const allErrorsEnabled = restDebug === 'true'

const ajvOptions = /** @type {import('ajv').Options} */ ({
  allErrors: allErrorsEnabled,
  strict: 'log',
  useDefaults: true,
  maxItems: 1000,
  maxProperties: 100,
  maxLength: 10000,
  maxErrors: 10
})

const ajv = new Ajv(ajvOptions)

// Add formats and error messages support
addFormats(ajv)
if (allErrorsEnabled) {
  ajvErrors(ajv)
}

// Register JSON schemas
ajv.addSchema(require('./curations-1.0.json'), 'curations')
ajv.addSchema(require('./curation-1.0.json'), 'curation')
ajv.addSchema(require('./definition-1.0.json'), 'definition')
ajv.addSchema(require('./harvest-1.0.json'), 'harvest')
ajv.addSchema(require('./notice-request.json'), 'notice-request')
ajv.addSchema(require('./definitions-find.json'), 'definitions-find')
ajv.addSchema(require('./definitions-get-dto-1.0.json'), 'definitions-get-dto')
ajv.addSchema(require('./coordinates-1.0.json'), 'coordinates-1.0')
ajv.addSchema(require('./versionless-coordinates-1.0.json'), 'versionless-coordinates-1.0')

module.exports = ajv
