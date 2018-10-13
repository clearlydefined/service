// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')

const location = config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')

function harvest(options) {
  return require('./fileHarvestStore')(options || { location })
}

function definition(options) {
  return require('./fileDefinitionStore')(options || { location: location + '-definition' })
}
function attachment(options) {
  return require('./fileAttachmentStore')(options || { location: location + '-attachment' })
}

module.exports = { harvest, definition, attachment }
