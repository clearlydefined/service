// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true })
require('ajv-errors')(ajv)
ajv.addSchema(require('../schemas/curations-1.0'), 'curations')
ajv.addSchema(require('../schemas/curation-1.0'), 'curation')
ajv.addSchema(require('../schemas/definition-1.0'), 'definition')
ajv.addSchema(require('../schemas/harvest-1.0'), 'harvest')
ajv.addSchema(require('../schemas/notice-request'), 'notice-request')

module.exports = ajv
