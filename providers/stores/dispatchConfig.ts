// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DefinitionStore } from '../../business/definitionService.js'

import dispatchDefinitionStore from './dispatchDefinitionStore.ts'

/** Options for configuring a dispatch definition store */
export interface DispatchConfigOptions {
  /** Array of factory functions that create definition stores */
  factories: Array<() => DefinitionStore>
}

/**
 * Creates a dispatch definition store with the given factory options.
 * The dispatch store delegates operations to multiple underlying stores.
 */
function definition(options: DispatchConfigOptions) {
  if (!options.factories) {
    throw new Error('no factories configured')
  }
  const stores = options.factories.map(x => x())
  return dispatchDefinitionStore({ stores })
}

export default definition
