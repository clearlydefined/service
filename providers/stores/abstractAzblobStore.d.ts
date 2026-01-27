// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { ResultCoordinates } from '../../lib/resultCoordinates'
import type { Logger } from '../logging'

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
declare class AbstractAzBlobStore {
  /** Configuration options for the store */
  protected options: AzBlobStoreOptions

  /** Name of the blob container */
  protected containerName: string

  /** Logger instance for the store */
  protected logger: Logger

  /** Azure blob service instance */
  protected blobService: any

  /**
   * Creates a new AbstractAzBlobStore instance
   *
   * @param options - Configuration options for the store
   */
  constructor(options: AzBlobStoreOptions)

  /**
   * Initializes the blob service and creates the container if needed
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>

  /**
   * Visit all of the blobs associated with the given coordinates.
   *
   * @param coordinates - Accepts partial coordinates
   * @param visitor - Function to apply to each blob entry
   * @returns The collection of results returned by the visitor
   */
  list<T>(coordinates: EntityCoordinates | ResultCoordinates, visitor: BlobStoreVisitor<T>): Promise<T[]>

  /**
   * Get and return the object at the given coordinates.
   *
   * @param coordinates - The coordinates of the object to get
   * @returns The loaded object or null if not found
   */
  get(coordinates: EntityCoordinates | ResultCoordinates): Promise<any>

  /**
   * Unsupported. The Blob definition store is not queryable.
   *
   * @returns null
   */
  find(): Promise<null>

  /**
   * Converts coordinates to a storage path
   *
   * @param coordinates - The coordinates to convert
   * @returns The storage path
   */
  protected _toStoragePathFromCoordinates(coordinates: EntityCoordinates | ResultCoordinates): string

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @param path - The storage path to convert
   * @returns The ResultCoordinates
   */
  protected _toResultCoordinatesFromStoragePath(path: string): ResultCoordinates
}

export = AbstractAzBlobStore
