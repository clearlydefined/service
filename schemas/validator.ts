// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { createRequire } from 'node:module'
import Ajv from 'ajv'
import ajvErrors from 'ajv-errors'
import addFormats from 'ajv-formats'
import config from 'painless-config'

const require = createRequire(import.meta.url)
const curationsSchema = require('./curations-1.0.json')
const curationSchema = require('./curation-1.0.json')
const definitionSchema = require('./definition-1.0.json')
const harvestSchema = require('./harvest-1.0.json')
const noticeRequestSchema = require('./notice-request.json')
const definitionsFindSchema = require('./definitions-find.json')
const definitionsGetDtoSchema = require('./definitions-get-dto-1.0.json')
const coordinatesSchema = require('./coordinates-1.0.json')
const versionlessCoordinatesSchema = require('./versionless-coordinates-1.0.json')

const restDebug = process.env['ENABLE_REST_VALIDATION_ERRORS'] || config.get('ENABLE_REST_VALIDATION_ERRORS')
const allErrorsEnabled = restDebug === 'true'

const ajvOptions = {
  allErrors: allErrorsEnabled,
  strict: 'log' as const,
  useDefaults: true,
  maxItems: 1000,
  maxProperties: 100,
  maxLength: 10000,
  maxErrors: 10,
  coerceTypes: true
}

const ajv = new Ajv.default(ajvOptions)

// Add formats and error messages support
// @ts-expect-error - ajv-formats/ajv-errors default exports are callable but typed as modules
addFormats(ajv)
if (allErrorsEnabled) {
  // @ts-expect-error - ajv-formats/ajv-errors default exports are callable but typed as modules
  ajvErrors(ajv)
}

// Register JSON schemas
ajv.addSchema(curationsSchema, 'curations')
ajv.addSchema(curationSchema, 'curation')
ajv.addSchema(definitionSchema, 'definition')
ajv.addSchema(harvestSchema, 'harvest')
ajv.addSchema(noticeRequestSchema, 'notice-request')
ajv.addSchema(definitionsFindSchema, 'definitions-find')
ajv.addSchema(definitionsGetDtoSchema, 'definitions-get-dto')
ajv.addSchema(coordinatesSchema, 'coordinates-1.0')
ajv.addSchema(versionlessCoordinatesSchema, 'versionless-coordinates-1.0')

export default ajv
