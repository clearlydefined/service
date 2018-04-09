// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const { promisify } = require('util')
const recursive = require('recursive-readdir')
const AbstractStore = require('./abstractStore')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))

class FileStore extends AbstractStore {
  constructor(options) {
    super()
    this.options = options
  }

  async list(coordinates, type = 'entity') {
    try {
      const paths = await recursive(this._toStoragePathFromCoordinates(coordinates))
      const list = new Set()
      paths.forEach(entry => {
        const value = this._getEntry(entry, type)
        if (!value) return
        list.add(value.toString())
      })
      return Array.from(list).sort()
    } catch (error) {
      // If there is just no entry, that's fine, there is no content.
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  _getEntry(entry, type) {
    const result = super._getEntry(entry, type)
    return ['git', 'npm', 'maven', 'sourcearchive'].includes(result.type) ? result : null
  }

  _toStoragePathFromCoordinates(coordinates) {
    const result = super._toStoragePathFromCoordinates(coordinates)
    return path.join(this.options.location, result)
  }

  _toResultCoordinatesFromStoragePath(path) {
    const trimmed = path.slice(this.options.location.length + 1)
    return super._toResultCoordinatesFromStoragePath(trimmed)
  }

  _toEntityCoordinatesFromStoragePath(path) {
    const trimmed = path.slice(this.options.location.length + 1)
    return super._toEntityCoordinatesFromStoragePath(trimmed)
  }

  /**
   * Get the output of running the tool specified in the coordinates on the entity specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get
   * @param {WriteStream} [stream] - The stream onto which the result is written, if specified
   * @returns {Definition} The result object if no stream is specified, otherwise the return value is unspecified.
   */
  async get(coordinates, stream) {
    const filePath = await this._getFilePath(coordinates)
    if (stream)
      return new Promise((resolve, reject) => {
        const read = fs.createReadStream(filePath)
        read.on('end', () => resolve(null))
        read.on('error', error => reject(error))
        read.pipe(stream)
      })
    return new Promise((resolve, reject) => fs.readFile(filePath, resultOrError(resolve, reject))).then(
      result => JSON.parse(result),
      error => {
        if (error.code === 'ENOENT') return null
        throw error
      }
    )
  }

  async _getFilePath(coordinates) {
    const toolPath = this._toStoragePathFromCoordinates(coordinates)
    if (coordinates.toolVersion) return toolPath + '.json'
    const latest = await this._findLatest(toolPath)
    if (!latest) return null
    return path.join(toolPath, latest) + '.json'
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  async getAll(coordinates) {
    // TODO validate/enforce that the coordiates are down to the component revision
    const root = this._toStoragePathFromCoordinates(coordinates)
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    let files = null
    try {
      files = await recursive(root)
    } catch (error) {
      if (error.code === 'ENOENT') return []
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

  _findLatest(filePath) {
    return new Promise((resolve, reject) => {
      fs.readdir(filePath, (error, list) => {
        if (error) return reject(error)
        const result = list.map(entry => (path.extname(entry) === '.json' ? path.basename(entry).slice(0, -5) : null))
        resolve(utils.getLatestVersion(result.filter(e => e)))
      })
    })
  }

  async store(coordinates, stream) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    const dirName = path.dirname(filePath)
    await promisify(mkdirp)(dirName)
    return new Promise((resolve, reject) => {
      const file = fs
        .createWriteStream(filePath)
        .on('finish', () => resolve())
        .on('error', error => reject(error))
      stream.pipe(file)
    })
  }

  delete(coordinates) {
    const filePath = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return promisify(fs.unlink)(filePath)
  }
}

module.exports = options => new FileStore(options)
