// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { AzBlobStoreOptions, BlobEntry } from './abstractAzblobStore'
import AbstractAzBlobStore = require('./abstractAzblobStore')

/** Definition object with coordinates */
export interface Definition {
  /** The coordinates identifying this definition */
  coordinates: EntityCoordinates
  [key: string]: any
}

/**
 * Azure Blob Storage implementation for storing component definitions.
 * Extends AbstractAzBlobStore with definition-specific functionality.
 */
declare class AzBlobDefinitionStore extends AbstractAzBlobStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @param coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  list(coordinates: EntityCoordinates): Promise<string[]>

  /**
   * Store a definition in Azure Blob Storage.
   *
   * @param definition - The definition to store
   * @returns Promise that resolves when the definition is stored
   */
  store(definition: Definition): Promise<void>

  /**
   * Delete a definition from Azure Blob Storage.
   *
   * @param coordinates - The coordinates of the definition to delete
   * @returns Promise that resolves when the definition is deleted
   */
  delete(coordinates: EntityCoordinates): Promise<void>
}

/**
 * Factory function to create an AzBlobDefinitionStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new AzBlobDefinitionStore instance
 */
declare function createAzBlobDefinitionStore(options: AzBlobStoreOptions): AzBlobDefinitionStore

export = createAzBlobDefinitionStore
