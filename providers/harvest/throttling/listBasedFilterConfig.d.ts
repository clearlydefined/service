// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import ListBasedFilter from './listBasedFilter'
import { Logger } from '../../logging'

/**
 * Parses a JSON array string from environment variable
 *
 * @param value - The string value to parse (expected to be JSON array)
 * @param logger - Logger instance for error reporting
 * @returns Parsed array or empty array if parsing fails
 */
declare function parseListEnv(value: string | undefined, logger: Logger): string[]

/**
 * Factory function that creates a ListBasedFilter instance from configuration
 *
 * @param listOpts - Optional override for the blacklist configuration
 * @returns A configured ListBasedFilter instance
 */
declare function throttlerFactory(listOpts?: string): ListBasedFilter

export = throttlerFactory
