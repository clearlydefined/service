// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./dispatchConfig').DispatchConfigOptions} DispatchConfigOptions
 */

/**
 * Creates a dispatch definition store with the given factory options.
 * The dispatch store delegates operations to multiple underlying stores.
 *
 * @param {DispatchConfigOptions} options - Configuration options containing store factories
 * @returns {ReturnType<typeof import('./dispatchDefinitionStore')>} A new DispatchDefinitionStore instance
 * @throws {Error} Error if no factories are configured
 */
function definition(options) {
  if (!options.factories) throw new Error('no factories configured')
  const stores = options.factories.map(x => x())
  return require('./dispatchDefinitionStore')({ stores })
}

module.exports = definition
