// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const EntityCoordinates = require('./entityCoordinates')

class PypiCoordinatesMapper {
  constructor(fetch = requestPromise) {
    this.baseUrl = 'https://pypi.python.org'
    this._fetch = fetch
  }

  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  _shouldResolve(coordinates) {
    if (typeof coordinates.name !== 'string' || coordinates.name.includes('/')) return false
    return coordinates.name.includes('.') || coordinates.name.includes('_') || coordinates.name.includes('-')
  }

  async _resolve(coordinates) {
    if (coordinates.name === '..') return null
    const url = new URL(`/pypi/${coordinates.name}/json`, this.baseUrl).toString()
    try {
      const answer = await this._fetch({ url, method: 'GET', json: true })
      return answer?.info?.name && { name: answer.info.name }
    } catch (error) {
      if (error.statusCode === 404) return null
      throw error
    }
  }
}

module.exports = PypiCoordinatesMapper
