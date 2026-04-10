// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { promisify } from 'node:util'
import azure from 'azure-storage'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import type { ResultCoordinates } from '../../lib/resultCoordinates.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import AbstractFileStore from './abstractFileStore.ts'

/** Options for configuring an AbstractAzBlobStore */
export interface AzBlobStoreOptions {
  /** Azure Storage connection string */
  connectionString: string
  /** Name of the blob container */
  containerName: string
  /** Optional logger instance */
  logger?: Logger
}

/** Azure blob entry metadata */
export interface BlobEntry {
  /** Name of the blob */
  name: string
  /** Blob metadata */
  metadata: Record<string, string>
}

/** Visitor function type for list operations */
export type BlobStoreVisitor<T> = (entry: BlobEntry) => T | null

/**
 * Abstract base class for Azure Blob Storage implementations.
 * Provides common functionality for reading and writing JSON to Azure Blob Storage.
 */
class AbstractAzBlobStore {
  options: AzBlobStoreOptions
  containerName: string
  logger: Logger
  declare blobService: any

  constructor(options: AzBlobStoreOptions) {
    this.options = options
    this.containerName = options.containerName
    this.logger = this.options.logger || logger()
  }

  /**
   * Initializes the blob service and creates the container if needed
   */
  async initialize(): Promise<void> {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists).bind(this.blobService)(this.containerName)
  }

  /**
   * Visit all of the blobs associated with the given coordinates.
   */
  async list<T>(coordinates: EntityCoordinates | ResultCoordinates, visitor: BlobStoreVisitor<T>): Promise<T[]> {
    const list: any[] = []
    let continuation = null
    do {
      const name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
      const result = await promisify(this.blobService.listBlobsSegmentedWithPrefix).bind(this.blobService)(
        this.containerName,
        name,
        continuation,
        {
          include: azure.BlobUtilities.BlobListingDetails.METADATA
        }
      )
      continuation = result.continuationToken
      for (const entry of result.entries as BlobEntry[]) {
        const visitResult = visitor(entry)
        if (visitResult !== null) {
          list.push(visitResult)
        }
      }
    } while (continuation)
    return list
  }

  /**
   * Get and return the object at the given coordinates.
   */
  async get(coordinates: EntityCoordinates | ResultCoordinates): Promise<any> {
    let name = AbstractFileStore.toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) {
      name += '.json'
    }
    try {
      const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
      return JSON.parse(result)
    } catch (error) {
      const azureError = error as { statusCode?: number }
      if (azureError.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Unsupported. The Blob definition store is not queryable.
   */
  async find(): Promise<null> {
    return null
  }

  _toStoragePathFromCoordinates(coordinates: EntityCoordinates | ResultCoordinates): string {
    return AbstractFileStore.toStoragePathFromCoordinates(coordinates)
  }

  _toResultCoordinatesFromStoragePath(path: string): ResultCoordinates {
    return AbstractFileStore.toResultCoordinatesFromStoragePath(path)
  }
}

export default AbstractAzBlobStore
