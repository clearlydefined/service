// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const { get, uniq, values } = require('lodash')
const base64 = require('base-64')
const AbstractSearch = require('./abstractSearch')

const serviceUrlTemplate = 'https://$service$.search.windows.net'
const apiVersion = '2016-09-01'
const coordinatesIndexName = 'coordinates'

class AzureSearch extends AbstractSearch {
  async initialize() {
    super.initialize()
    if (!await this._hasIndex(coordinatesIndexName)) this._createIndex(this._buildCoordinatesIndex())
  }

  /**
   * Get the search document associated with the given coordinates
   *
   * @param {EntityCoordinates} coordinates - The coordinates of the result to get
   * @returns The object found at the given coordinates
   */
  async get(coordinates) {
    const searchResult = await requestPromise({
      method: 'GET',
      url: this._buildUrl(`indexes/${coordinatesIndexName}/docs/${this._getKey(coordinates)}`),
      headers: this._getHeaders(),
      json: true,
      withCredentials: false
    })
  }

  /**
   * Get a list of coordinates suggested for the given pattern
   * @param {String} pattern - A pattern to look for in the coordinates of a definition
   * @returns {String[]} The list of suggested coordinates found
   */
  async suggestCoordinates(pattern) {
    const baseUrl = this._buildUrl(`indexes/${coordinatesIndexName}/docs/suggest`)
    const url = `${baseUrl}&search=${pattern}&suggesterName=suggester&$select=coordinates&$top=50`
    const searchResult = await requestPromise({
      method: 'GET',
      url,
      headers: this._getHeaders(),
      json: true,
      withCredentials: false
    })
    return searchResult.value.map(result => result.coordinates)
  }

  /**
   * Index the given definition in the search system
   * @param {Definition} definition - the definition to index
   */
  store(definition) {
    const entry = this._getEntry(definition)
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${coordinatesIndexName}/docs/index`),
      headers: this._getHeaders(),
      body: { value: [entry] },
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  /**
   * Deletely the identified definition from the search system
   * @param {EntityCoordinates} coordinates - the coordinates of the definition to delete
   */
  delete(coordinates) {
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${coordinatesIndexName}/docs/index`),
      headers: this._getHeaders(),
      body: { value: [{ '@search.action': 'delete', key: this._getKey(coordinates) }] },
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  _getKey(coordinats) {
    return base64.encode(coordinates.toString())
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

  _buildCoordinatesIndex() {
    return {
      name: coordinatesIndexName,
      fields: [
        { name: 'key', type: 'Edm.String', key: true },
        { name: 'coordinates', type: 'Edm.String' },
        { name: 'declaredLicense', type: 'Edm.String' },
        { name: 'discoveredLicenses', type: 'Collection(Edm.String)' },
        { name: 'attributionParties', type: 'Collection(Edm.String)' },
        { name: 'releaseDate', type: 'Edm.DateTimeOffset' }
      ],
      suggesters: [
        {
          name: 'suggester',
          searchMode: 'analyzingInfixMatching',
          sourceFields: ['coordinates']
        }
      ]
    }
  }

  _createIndex(body) {
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes`),
      headers: this._getHeaders(),
      body,
      withCredentials: false,
      json: true
    })
    // TODO handle the status codes as described https://docs.microsoft.com/en-us/azure/search/search-import-data-rest-api
  }

  async _hasIndex(name) {
    const index = await requestPromise({
      method: 'GET',
      url: this._buildUrl(`indexes/${name}`),
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
