// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { FileStoreOptions } from './abstractFileStore'
import AbstractFileStore = require('./abstractFileStore')

/** Definition object with coordinates */
export interface Definition {
  /** The coordinates identifying this definition */
  coordinates: EntityCoordinates
  [key: string]: any
}

/**
 * File system implementation for storing component definitions.
 * Extends AbstractFileStore with definition-specific functionality.
 */
declare class FileDefinitionStore extends AbstractFileStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @param coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  list(coordinates: EntityCoordinates): Promise<string[]>

  /**
   * Store a definition to the file system.
   *
   * @param definition - The definition to store
   * @returns Promise that resolves when the definition is stored
   */
  store(definition: Definition): Promise<void>

  /**
   * Delete a definition from the file system.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @returns Promise that resolves when the definition is deleted
   */
  delete(coordinates: EntityCoordinates): Promise<void>
}

/**
 * Factory function to create a FileDefinitionStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new FileDefinitionStore instance
 */
declare function createFileDefinitionStore(options?: FileStoreOptions): FileDefinitionStore

export = createFileDefinitionStore
