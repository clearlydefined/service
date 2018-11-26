// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const logger = require('../logging/logger')

class FileAttachmentStore {
  constructor(options) {
    this.logger = logger()
    this.options = options
  }

  async initialize() {}

  /**
   * Get the attachment object by the given key.
   *
   * @param {string} key - The key that identifies the attachment to get
   * @returns The requested attachment.
   */
  async get(key) {
    try {
      const filePath = path.join(this.options.location, key + '.json')
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result).attachment
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
}

module.exports = options => new FileAttachmentStore(options)
