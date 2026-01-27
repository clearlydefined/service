// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./abstractFileStore').FileStoreOptions} FileStoreOptions
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinatesType
 * @typedef {import('./fileDefinitionStore').Definition} Definition
 */

const fs = require('fs')
const path = require('path')
const { mkdirp } = require('mkdirp')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')
const { promisify } = require('util')

/**
 * File system implementation for storing component definitions.
 * Extends AbstractFileStore with definition-specific functionality.
 */
class FileDefinitionStore extends AbstractFileStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @override
   * @param {EntityCoordinatesType} coordinates - Accepts partial coordinates.
   * @returns {Promise<string[]>} A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  async list(coordinates) {
    const list = await super.list(
      coordinates,
      /** @param {any} object */ object => {
        const definitionCoordinates = EntityCoordinates.fromObject(object.coordinates)
        return definitionCoordinates ? definitionCoordinates.toString() : null
      }
    )
    return sortedUniq(list.filter(x => x))
  }

  /**
   * Store a definition to the file system.
   *
   * @param {Definition} definition - The definition to store
   * @returns {Promise<void>} Promise that resolves when the definition is stored
   */
  async store(definition) {
    const { coordinates } = definition
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    const dirName = path.dirname(filePath)
    await mkdirp(dirName)
    return promisify(fs.writeFile)(filePath, JSON.stringify(definition, null, 2), 'utf8')
  }

  /**
   * Delete a definition from the file system.
   *
   * @param {EntityCoordinatesType} coordinates - The coordinates of the definition to delete
   * @returns {Promise<void>} Promise that resolves when the definition is deleted
   */
  async delete(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      await promisify(fs.unlink)(filePath)
    } catch (/** @type {any} */ error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

/**
 * Factory function to create a FileDefinitionStore instance.
 *
 * @param {FileStoreOptions} [options] - Configuration options for the store
 * @returns {FileDefinitionStore} A new FileDefinitionStore instance
 */
module.exports = options => new FileDefinitionStore(options)
