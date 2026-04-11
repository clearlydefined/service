// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { promisify } from 'node:util'
import azure from 'azure-storage'
import Bottleneck from 'bottleneck'
import type { Logger } from '../logging/index.js'
import type { AzBlobStoreOptions } from './abstractAzblobStore.ts'

const limiter = new Bottleneck({ maxConcurrent: 1000 })

import logger from '../logging/logger.ts'

/**
 * Azure Blob Storage implementation for storing and retrieving attachments.
 * Uses rate limiting to control concurrent access.
 */
export class AzBlobAttachmentStore {
  options: AzBlobStoreOptions
  containerName: string
  logger: Logger
  declare blobService: any

  constructor(options: AzBlobStoreOptions) {
    this.options = options
    this.containerName = options.containerName
    this.logger = logger()
  }

  /**
   * Initializes the blob service and creates the container if needed.
   */
  async initialize(): Promise<void> {
    this.blobService = azure
      .createBlobService(this.options.connectionString)
      .withFilter(new azure.LinearRetryPolicyFilter())
    return promisify(this.blobService.createContainerIfNotExists).bind(this.blobService)(this.containerName)
  }

  /**
   * Get the attachment object by the given key.
   */
  get(key: string): Promise<any | null> {
    return limiter.wrap(async () => {
      try {
        const name = `attachment/${key}.json`
        this.logger.info('2:1:1:notice_generate:get_single_file:start', { ts: new Date().toISOString(), file: key })
        const result = await promisify(this.blobService.getBlobToText).bind(this.blobService)(this.containerName, name)
        this.logger.info('2:1:1:notice_generate:get_single_file:end', { ts: new Date().toISOString(), file: key })
        return JSON.parse(result).attachment
      } catch (error: any) {
        if (error.statusCode === 404) {
          return null
        }
        throw error
      }
    })()
  }
}

/**
 * Factory function to create an AzBlobAttachmentStore instance.
 */
export default (options: AzBlobStoreOptions): AzBlobAttachmentStore => new AzBlobAttachmentStore(options)
