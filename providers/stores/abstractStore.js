// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const throat = require('throat')
const EntityCoordinates = require('../../lib/entityCoordinates')
const ResultCoordinates = require('../../lib/resultCoordinates')

class AbstractStore {
  /**
   * List all of the tool output available for the given coordinates. The coordinates can be
   * arbitrarily loose. The result will have an entry per discovered component. That entry will
   * itself have an entry per tool with the value being the array of versions of the tool for
   * which there are result.
   *
   * @param {*} coordinatesList - an array of coordinate paths to list
   * @returns A list of all components that have output and the output available
   */
  async listAll(coordinatesList, type = 'entity') {
    const result = {}
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        const list = await this.list(coordinates, type)
        list.forEach(entry => {
          if (entry.length === 0) return
          const spec = entry.asEntityCoordinates().toString()
          const data = (result[spec] = result[spec] || {})
          if (type === 'result') {
            const current = (data[entry.tool] = data[entry.toolVersion] || [])
            current.push(entry.toolVersion)
          }
        })
      })
    )
    await Promise.all(promises)
    return result
  }

  _getEntry(entry, type) {
    if (entry.startsWith('deadletter/')) return null
    if (type === 'entity') return this._toEntityCoordinatesFromStoragePath(entry)
    if (type === 'result') return this._toResultCoordinatesFromStoragePath(entry)
    throw new Error(`Invalid list type: ${type}`)
  }

  _toResultCoordinatesFromStoragePath(path) {
    const trimmed = this._trimStoragePath(path)
    return ResultCoordinates.fromString(trimmed)
  }

  // Extract the entity coordinates from the storage path
  _toEntityCoordinatesFromStoragePath(path) {
    const trimmed = this._trimStoragePath(path)
    return EntityCoordinates.fromString(trimmed)
  }

  _trimStoragePath(path) {
    const normalized = path.replace(/\\/g, '/').replace('.json', '')
    const rawSegments = normalized.split('/')
    const segments = rawSegments[0] === '' ? rawSegments.slice(1) : rawSegments
    const name = segments.slice(0, 4)
    const revision = segments.slice(5, 6)
    const toolSpec = segments.slice(7, 9)
    return name.concat(revision, toolSpec).join('/')
  }

  _toStoragePathFromCoordinates(coordinates) {
    const c = coordinates
    const revisionPart = c.revision ? `revision/${c.revision}` : null
    const toolVersionPart = c.toolVersion ? c.toolVersion : null
    const toolPart = c.tool ? `tool/${c.tool}` : null
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = c.provider ? c.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [c.type, c.provider, namespace, c.name, revisionPart, toolPart, toolVersionPart]
      .filter(s => s)
      .join('/')
      .toLowerCase()
  }
}

module.exports = AbstractStore
