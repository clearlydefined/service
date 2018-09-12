// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const {promisify} = require('util')
const recursive = require('recursive-readdir')
const AbstractStore = require('./abstractStore')
const EntityCoordinates = require('../../lib/entityCoordinates')
const ResultCoordinates = require('../../lib/resultCoordinates')
const {sortedUniq, get} = require('lodash')

const resultOrError = (resolve, reject) => (error, result) => (error ? reject(error) : resolve(result))

class FileStore extends AbstractStore {
  constructor(options) {
    super()
    this.options = options
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  async list(coordinates, type = 'entity') {
    try {
      const coordinateClass = type === 'result' ? ResultCoordinates : EntityCoordinates
      const paths = await recursive(this._toStoragePathFromCoordinates(coordinates), ['.DS_Store'])
      const list = await Promise.all(
        paths.map(path => {
          if (!this._isValidPath(path)) return null
          return new Promise((resolve, reject) =>
            fs.readFile(path, (error, data) => {
              if (error) return reject(error)
              const object = JSON.parse(data)
              const link = get(object, '_metadata.links.self.href')
              if (link) return resolve(coordinateClass.fromUrn(link).toString())
              // assume its a definition and look for a coordinates object
              const definitionCoordinates = coordinateClass.fromObject(object.coordinates)
              resolve(definitionCoordinates ? definitionCoordinates.toString() : null)
            })
          )
        })
      )
      return sortedUniq(list.filter(x => x))
    } catch (error) {
      // If there is just no entry, that's fine, there is no content.
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  _isValidPath(entry) {
    return this.isInterestingCoordinates(this._toResultCoordinatesFromStoragePath(entry))
  }

  _toStoragePathFromCoordinates(coordinates) {
    const result = super._toStoragePathFromCoordinates(coordinates)
    return path.join(this.options.location, result)
  }

  _toResultCoordinatesFromStoragePath(path) {
    const trimmed = path.slice(this.options.location.length + 1)
    return super._toResultCoordinatesFromStoragePath(trimmed)
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
            (error, data) => (error ? reject(error) : resolve({name: file, content: JSON.parse(data)}))
          )
        )
      })
    )
    return contents.reduce((result, entry) => {
      const {tool, toolVersion} = this._toResultCoordinatesFromStoragePath(entry.name)
      const current = (result[tool] = result[tool] || {})
      current[toolVersion] = entry.content
      return result
    }, {})
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
    return new Promise((resolve, reject) => fs.readFile(filePath, resultOrError(resolve, reject))).then(
      result => JSON.parse(result),
      error => {
        if (error.code === 'ENOENT') return null
        throw error
      }
    )
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
