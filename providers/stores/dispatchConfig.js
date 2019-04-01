// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

function definition(options) {
  if (!options.factories) throw new Error('no factories configured')
  const stores = options.factories.map(x => x())
  return require('./dispatchDefinitionStore')({ stores })
}

module.exports = definition
