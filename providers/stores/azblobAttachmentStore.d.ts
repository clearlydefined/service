// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'

/** Options for configuring an AzBlobAttachmentStore */
export interface AzBlobAttachmentStoreOptions {
  /** Azure Storage connection string */
  connectionString: string
  /** Name of the blob container */
  containerName: string
}

/**
 * Azure Blob Storage implementation for storing and retrieving attachments.
 * Uses rate limiting to control concurrent access.
 */
declare class AzBlobAttachmentStore {
  /** Configuration options for the store */
  options: AzBlobAttachmentStoreOptions

  /** Name of the blob container */
  containerName: string

  /** Logger instance for the store */
  logger: Logger

  /** Azure blob service instance */
  blobService: any

  /**
   * Creates a new AzBlobAttachmentStore instance.
   *
   * @param options - Configuration options for the store
   */
  constructor(options: AzBlobAttachmentStoreOptions)

  /**
   * Initializes the blob service and creates the container if needed.
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>

  /**
   * Get the attachment object by the given key.
   *
   * @param key - The key that identifies the attachment to get
   * @returns The requested attachment or null if not found
   */
  get(key: string): Promise<any | null>
}

/**
 * Factory function to create an AzBlobAttachmentStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new AzBlobAttachmentStore instance
 */
declare function createAzBlobAttachmentStore(options: AzBlobAttachmentStoreOptions): AzBlobAttachmentStore

export = createAzBlobAttachmentStore
