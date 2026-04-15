// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Definition, DefinitionFindQuery, DefinitionFindResult, DefinitionStore } from '../../business/definitionService.ts'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import EntityCoordinatesClass from '../../lib/entityCoordinates.ts'
import type { AzBlobStoreOptions, BlobEntry } from './abstractAzblobStore.ts'
import AbstractAzBlobStore from './abstractAzblobStore.ts'
import AbstractFileStore from './abstractFileStore.ts'

const { sortedUniq } = lodash

import { promisify } from 'node:util'

/**
 * Azure Blob Storage implementation for storing component definitions.
 * Extends AbstractAzBlobStore with definition-specific functionality.
 */
export class AzBlobDefinitionStore extends AbstractAzBlobStore implements DefinitionStore {
  /**
   * List all of the definitions for the given coordinates.
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  override async list(coordinates: EntityCoordinates): Promise<string[]> {
    const list = await super.list(coordinates, (entry: BlobEntry) => {
      const path = entry.metadata['id']
      if (!path) {
        return null
      }
      const entryCoordinates = EntityCoordinatesClass.fromString(path)!
      return AbstractFileStore.isInterestingCoordinates(entryCoordinates) ? path : null
    })
    return sortedUniq(list.filter((x: string | null) => x))
  }

  /**
   * Store a definition in Azure Blob Storage.
   */
  async store(definition: Definition): Promise<void> {
    const blobName = `${this._toStoragePathFromCoordinates(definition.coordinates)}.json`
    return promisify(this.blobService.createBlockBlobFromText).bind(this.blobService)(
      this.containerName,
      blobName,
      JSON.stringify(definition),
      {
        blockIdPrefix: 'block',
        contentSettings: { contentType: 'application/json' },
        metadata: { id: definition.coordinates.toString() }
      }
    )
  }

  /**
   * Delete a definition from Azure Blob Storage.
   */
  async delete(coordinates: EntityCoordinates): Promise<void> {
    const blobName = `${this._toStoragePathFromCoordinates(coordinates)}.json`
    try {
      await promisify(this.blobService.deleteBlob).bind(this.blobService)(this.containerName, blobName)
    } catch (error: any) {
      if (error.code !== 'BlobNotFound') {
        throw error
      }
    }
  }

  // @ts-expect-error - AzBlob store does not support find; satisfies DefinitionStore interface
  override async find(_query: DefinitionFindQuery, _continuationToken?: string): Promise<DefinitionFindResult> {
    return super.find() as unknown as DefinitionFindResult
  }
}

/**
 * Factory function to create an AzBlobDefinitionStore instance.
 */
export default (options: AzBlobStoreOptions): AzBlobDefinitionStore => new AzBlobDefinitionStore(options)
