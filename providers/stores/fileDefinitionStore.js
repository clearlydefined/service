// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
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

  async store(coordinates, definition) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    const dirName = path.dirname(filePath)
    await promisify(mkdirp)(dirName)
    return promisify(fs.writeFile)(filePath, JSON.stringify(definition, null, 2), 'utf8')
  }

  delete(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return promisify(fs.unlink)(filePath)
  }

  /**
   * Get the attachment object by AttachmentCoordinates.
   * The result object contains metadata about the attachment as well as the attachment itself
   * If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {AttachmentCoordinates} coordinates - The coordinates of the attachment to get
   * @param {WriteStream} [stream] - The stream onto which the output is written, if specified
   * @returns The result object if no stream is specified, otherwise the return value is unspecified.
   */
  async getAttachment(coordinates, stream) {
    let filePath = path.join(this.options.location, coordinates.toString())
    if (!filePath.endsWith('.json')) filePath += '.json'
    if (stream)
      return new Promise((resolve, reject) => {
        const read = fs.createReadStream(filePath)
        read.on('end', () => resolve(null))
        read.on('error', error => reject(error))
        read.pipe(stream)
      })
    try {
      const result = await promisify(fs.readFile)(filePath)
      return JSON.parse(result)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
}

module.exports = options => new FileDefinitionStore(options)
