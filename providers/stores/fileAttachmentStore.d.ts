// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from '../logging'

/** Options for configuring a FileAttachmentStore */
export interface FileAttachmentStoreOptions {
  /** Base directory location for file storage */
  location: string
}

/**
 * File system implementation for storing and retrieving attachments.
 */
declare class FileAttachmentStore {
  /** Configuration options for the store */
  options: FileAttachmentStoreOptions

  /** Logger instance for the store */
  logger: Logger

  /**
   * Creates a new FileAttachmentStore instance.
   *
   * @param options - Configuration options for the store
   */
  constructor(options: FileAttachmentStoreOptions)

  /**
   * Initializes the store (no-op for file stores).
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
 * Factory function to create a FileAttachmentStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new FileAttachmentStore instance
 */
declare function createFileAttachmentStore(options: FileAttachmentStoreOptions): FileAttachmentStore

export = createFileAttachmentStore
