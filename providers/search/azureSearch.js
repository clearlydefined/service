// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')

const serviceUrlTemplate = 'https://$service$.search.windows.net'
const apiVersion = '2016-09-01'
const indexName = 'definitions'

class AzureSearch {
  constructor(options) {
    this.options = options
  }

  async _list(coordinates) {
    const result = await new Promise((resolve, reject) => {
      const name = this._toStoragePathFromCoordinates(coordinates)
      this.searchService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
    })
    return result.entries.map(entry => entry.name)
  }

  _filter(list) {
    return list.filter(entry => entry.type !== 'deadletter')
  }

  /**
   * Get the results of running the tool specified in the coordinates on the entty specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get
   * @returns The object found at the given coordinates
   */
  get(coordinates) {
    let name = this._toStoragePathFromCoordinates(coordinates)
    if (!name.endsWith('.json')) name += '.json'
    return requestPromise({
      method: 'GET',
      url: this._buildUrl(`indexes/${indexName}`),
      headers: this._getHeaders(),
      json: true,
      withCredentials: false
    })
  }

  _buildUrl(endpoint) {
    const baseUrl = serviceUrlTemplate.replace('$service$', this.options.service)
    return `${baseUrl}/${endpoint}?api-version=${apiVersion}`
  }

  _getHeaders() {
    return {
      'api-key': this.options.apiKey,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision.
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  // getAll(coordinates) {
  //   const name = this._toStoragePathFromCoordinates(coordinates)
  //   // Note that here we are assuming the number of blobs will be small-ish (<10) and
  //   // a) all fit in memory reasonably, and
  //   // b) fit in one list call (i.e., <5000)
  //   const list = new Promise((resolve, reject) => {
  //     this.searchService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject))
  //   })
  //   const contents = list.then(files => {
  //     return Promise.all(
  //       files.entries.map(file => {
  //         return new Promise((resolve, reject) => {
  //           this.searchService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject))
  //         }).then(result => {
  //           return { name: file.name, content: JSON.parse(result) }
  //         })
  //       })
  //     )
  //   })
  //   return contents.then(entries => {
  //     return entries.reduce((result, entry) => {
  //       const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name)
  //       const current = (result[tool] = result[tool] || {})
  //       current[toolVersion] = entry.content
  //       return result
  //     }, {})
  //   })
  // }

  store(coordinates, object) {
    const name = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${indexName}`),
      headers: this._getHeaders(),
      body: { value: [{ '@search.action': 'upload', coordinates, ...object }] },
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  delete(coordinates) {
    const name = this._toStoragePathFromCoordinates(coordinates) + '.json'
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${indexName}`),
      headers: this._getHeaders(),
      body: { value: [{ '@search.action': 'delete', coordinates }] },
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  async initialize() {
    const index = await this._getIndex()
    if (index) return
    return this._createIndex()
  }

  _createIndex() {
    const index = {
      name: indexName,
      fields: [
        { name: 'coordinates', type: 'Edm.String', key: true, facetable: false },
        { name: 'copyrightHolders', type: 'Collection(Edm.String)' },
        { name: 'releaseDate', type: 'Edm.DateTimeOffset' }
      ]
    }
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes`),
      headers: this._getHeaders(),
      body: index,
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  async _getIndex() {
    const index = await requestPromise({
      method: 'GET',
      url: this._buildUrl(`indexes/${indexName}`),
      headers: this._getHeaders(),
      withCredentials: false,
      simple: false,
      resolveWithFullResponse: true,
      json: true
    })
    return index.statusCode === 200
  }
}

module.exports = options => new AzureSearch(options)
