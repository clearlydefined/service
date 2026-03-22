// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'
import type { ICache } from '../caching'
import type { Definition, DefinitionService, UpgradeHandler } from '../../business/definitionService'

/** Configuration options for DefinitionVersionChecker */
export interface DefinitionVersionCheckerOptions {
  /** Logger instance for logging operations */
  logger?: Logger
}

/**
 * Checks whether a definition's schema version is current.
 * Returns the definition unchanged when its version is >= the current schema,
 * or undefined when the definition is stale and needs recomputation.
 */
export declare class DefinitionVersionChecker implements UpgradeHandler {
  options: DefinitionVersionCheckerOptions
  logger: Logger

  /** The current schema version. Must be set before calling validate(). */
  currentSchema: string

  constructor(options?: DefinitionVersionCheckerOptions)

  /**
   * Validates that a definition's schema version is current.
   *
   * @param definition - The definition to check
   * @returns The definition if up-to-date, undefined if stale
   */
  validate(definition: Definition | null): Promise<Definition | undefined>

  /** No-op initialization (exists for interface compatibility) */
  initialize(): Promise<void>

  /** No-op setup (exists for interface compatibility with subclass overrides) */
  setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean, sharedCache?: ICache): void

  /**
   * Extracts a string representation of coordinates from a definition.
   *
   * @param definition - The definition to extract coordinates from
   * @returns String coordinates or undefined if the definition has none
   */
  static getCoordinates(definition: Definition): string | undefined
}

/**
 * Factory function to create a new DefinitionVersionChecker instance.
 *
 * @param options - Configuration options
 * @returns A new DefinitionVersionChecker instance
 */
export declare function factory(options?: DefinitionVersionCheckerOptions): DefinitionVersionChecker
