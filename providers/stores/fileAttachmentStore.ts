// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'

/** Options for configuring a FileAttachmentStore */
export interface FileAttachmentStoreOptions {
  /** Base directory location for file storage */
  location: string
}

/**
 * File system implementation for storing and retrieving attachments.
 */
export class FileAttachmentStore {
  logger: Logger
  options: FileAttachmentStoreOptions

  constructor(options: FileAttachmentStoreOptions) {
    this.logger = logger()
    this.options = options
  }

  /**
   * Initializes the store (no-op for file stores).
   */
  async initialize(): Promise<void> {}

  /**
   * Get the attachment object by the given key.
   */
  async get(key: string): Promise<any | null> {
    try {
      const filePath = path.join(this.options.location, `${key}.json`)
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result.toString()).attachment
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }
}

/**
 * Factory function to create a FileAttachmentStore instance.
 */
export default (options: FileAttachmentStoreOptions): FileAttachmentStore => new FileAttachmentStore(options)
