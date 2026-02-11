// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { DispatchDefinitionStore, DefinitionStore } from './dispatchDefinitionStore'

/** Options for configuring a dispatch definition store */
export interface DispatchConfigOptions {
  /** Array of factory functions that create definition stores */
  factories: Array<() => DefinitionStore>
}

/**
 * Creates a dispatch definition store with the given factory options.
 * The dispatch store delegates operations to multiple underlying stores.
 *
 * @param options - Configuration options containing store factories
 * @returns A new DispatchDefinitionStore instance
 * @throws Error if no factories are configured
 */
declare function definition(options: DispatchConfigOptions): DispatchDefinitionStore

export = definition
