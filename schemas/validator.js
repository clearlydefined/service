// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Ajv = require('ajv')
const ajvErrors = require('ajv-errors')
const addFormats = require('ajv-formats')

// Create AJV instance with options
const ajv = new Ajv({ allErrors: true, strict: false })

// Add formats and error messages support
addFormats(ajv)
ajvErrors(ajv)

// Register JSON schemas
ajv.addSchema(require('./curations-1.0'), 'curations')
ajv.addSchema(require('./curation-1.0'), 'curation')
ajv.addSchema(require('./definition-1.0'), 'definition')
ajv.addSchema(require('./harvest-1.0'), 'harvest')
ajv.addSchema(require('./notice-request'), 'notice-request')
ajv.addSchema(require('./definitions-find'), 'definitions-find')
ajv.addSchema(require('./definitions-get-dto-1.0'), 'definitions-get-dto')
ajv.addSchema(require('./coordinates-1.0'), 'coordinates-1.0')

module.exports = ajv
