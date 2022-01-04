// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const fs = require('fs')
const recursive = require('recursive-readdir')
const AbstractFileStore = require('./abstractFileStore')
const ResultCoordinates = require('../../lib/resultCoordinates')
const { sortedUniq, get } = require('lodash')

class FileHarvestStore extends AbstractFileStore {
  /**
   * List all of the results for the given coordinates.
   *
   * @param {ResultCoordinates} coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3/tool/scancode/2.9.2' ]
   */
  async list(coordinates) {
    const list = await super.list(coordinates, entry => {
      const link = get(entry, '_metadata.links.self.href')
      if (!link) return null
      return ResultCoordinates.fromUrn(link).toString()
    })
    return sortedUniq(list.filter(x => x))
  }

  /**
   * Stream the content identified by the coordinates onto the given the stream and close the stream.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the content to access
   * @param {WriteStream} [stream] - The stream onto which the output is written
   */
  async stream(coordinates, stream) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return new Promise((resolve, reject) => {
      const read = fs.createReadStream(filePath)
      read.on('end', () => resolve(null))
      read.on('error', error => reject(error))
      read.pipe(stream)
    })
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  async getAll(coordinates) {
    // TODO validate/enforce that the coordinates are down to the component revision
    const root = this._toStoragePathFromCoordinates(coordinates)
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    let files = null
    try {
      files = await recursive(root, ['.DS_Store'])
    } catch (error) {
      if (error.code === 'ENOENT') return {}
      throw error
    }
    const contents = await Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) =>
          fs.readFile(
            file,
            (error, data) => (error ? reject(error) : resolve({ name: file, content: JSON.parse(data) }))
          )
        )
      })
    )
    return contents.reduce((result, entry) => {
      const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
      const current = (result[tool] = result[tool] || {})
      current[toolVersion] = entry.content
      return result
    }, {})
  }
}

module.exports = options => new FileHarvestStore(options)
