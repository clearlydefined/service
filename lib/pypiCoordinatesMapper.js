// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const EntityCoordinates = require('./entityCoordinates')

class PypiCoordinatesMapper {
  constructor() {
    this.baseUrl = 'https://pypi.python.org'
  }

  async map(coordinates) {
    if (!this._shouldResolve(coordinates)) return null
    const resolved = await this._resolve(coordinates)
    return resolved && EntityCoordinates.fromObject({ ...coordinates, ...resolved })
  }

  _shouldResolve(coordinates) {
    return coordinates.name.includes('.') ||
      coordinates.name.includes('_') ||
      coordinates.name.includes('-')
  }

  async _resolve(coordinates) {
    const url = `${this.baseUrl}/pypi/${coordinates.name}/json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return answer?.info?.name && { name: answer.info.name }
  }
}

module.exports = PypiCoordinatesMapper