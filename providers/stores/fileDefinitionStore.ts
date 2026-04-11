// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fs from 'node:fs'
import path from 'node:path'
import lodash from 'lodash'
import { mkdirp } from 'mkdirp'
import type { Definition } from '../../business/definitionService.js'
import type { EntityCoordinates } from '../../lib/entityCoordinates.ts'
import EntityCoordinatesClass from '../../lib/entityCoordinates.ts'
import type { FileStoreOptions } from './abstractFileStore.ts'
import AbstractFileStore from './abstractFileStore.ts'

const { sortedUniq } = lodash

import { promisify } from 'node:util'

/**
 * File system implementation for storing component definitions.
 * Extends AbstractFileStore with definition-specific functionality.
 */
export class FileDefinitionStore extends AbstractFileStore {
  /**
   * List all of the definitions for the given coordinates.
   */
  // @ts-expect-error - Simplified list signature (visitor is handled internally)
  override async list(coordinates: EntityCoordinates): Promise<string[]> {
    const list = await super.list(coordinates, (object: any) => {
      const definitionCoordinates = EntityCoordinatesClass.fromObject(object.coordinates)
      return definitionCoordinates ? definitionCoordinates.toString() : null
    })
    return sortedUniq(list.filter(x => x))
  }

  /**
   * Store a definition to the file system.
   */
  async store(definition: Definition): Promise<void> {
    const { coordinates } = definition
    const filePath = `${this._toStoragePathFromCoordinates(coordinates)}.json`
    const dirName = path.dirname(filePath)
    await mkdirp(dirName)
    return promisify(fs.writeFile)(filePath, JSON.stringify(definition, null, 2), 'utf8')
  }

  /**
   * Delete a definition from the file system.
   */
  async delete(coordinates: EntityCoordinates): Promise<void> {
    const filePath = `${this._toStoragePathFromCoordinates(coordinates)}.json`
    try {
      await promisify(fs.unlink)(filePath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}

/**
 * Factory function to create a FileDefinitionStore instance.
 */
export default (options?: FileStoreOptions): FileDefinitionStore => new FileDefinitionStore(options)
