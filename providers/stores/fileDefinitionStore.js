// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const path = require('path')
const { mkdirp } = require('mkdirp')
const AbstractFileStore = require('./abstractFileStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { sortedUniq } = require('lodash')
const { promisify } = require('util')

class FileDefinitionStore extends AbstractFileStore {
  /**
   * List all of the definitions for the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - Accepts partial coordinates.
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates) {
    const list = await super.list(coordinates, object => {
      const definitionCoordinates = EntityCoordinates.fromObject(object.coordinates)
      return definitionCoordinates ? definitionCoordinates.toString() : null
    })
    return sortedUniq(list.filter(x => x))
  }

  async store(definition) {
    const { coordinates } = definition
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    const dirName = path.dirname(filePath)
    await mkdirp(dirName)
    return promisify(fs.writeFile)(filePath, JSON.stringify(definition, null, 2), 'utf8')
  }

  async delete(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    try {
      await promisify(fs.unlink)(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

module.exports = options => new FileDefinitionStore(options)
