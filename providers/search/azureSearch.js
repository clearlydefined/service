// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const { get } = require('lodash')
const base64 = require('base-64')
const AbstractSearch = require('./abstractSearch')
const EntityCoordinates = require('../../lib/entityCoordinates')

const serviceUrlTemplate = 'https://$service$.search.windows.net'
const apiVersion = '2017-11-11'
const coordinatesIndexName = 'coordinates'

class AzureSearch extends AbstractSearch {
  async initialize() {
    super.initialize()
    if (!(await this._hasIndex(coordinatesIndexName))) this._createIndex(this._buildCoordinatesIndex())
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
   * @param {Definition or Definition[]} definitions - the definition(s) to index
   */
  store(definitions) {
    const entries = this._getEntries(Array.isArray(definitions) ? definitions : [definitions])
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${coordinatesIndexName}/docs/index`),
      headers: this._getHeaders(),
      body: { value: entries },
      withCredentials: false,
      resolveWithFullResponse: true
    })
    .then(function (res) {
        console.log("POST returned with status %d", handleResponseCodes(res.statusCode));
    })
    .catch(function (err) {
        console.log("POST failed with status %d", err.statusCode);
        console.log(err)
    });
  }

  _getEntries(definitions) {
    return definitions.map(definition => {
      const coordinatesString = EntityCoordinates.fromObject(definition.coordinates).toString()
      const date = get(definition, 'described.releaseDate')
      // TODO temporary hack to deal with bad data in dev blobs
      const releaseDate = date === '%cI' ? null : date
      return {
        '@search.action': 'upload',
        key: base64.encode(coordinatesString),
        coordinates: coordinatesString,
        releaseDate,
        declaredLicense: get(definition, 'licensed.declared'),
        discoveredLicenses: this._getLicenses(definition),
        attributionParties: this._getAttributions(definition)
      }
    })
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
      resolveWithFullResponse: true
    })
    .then(function (res) {
        console.log("POST returned with status %d", handleResponseCodes(res.statusCode));
    })
    .catch(function (err) {
        console.log("POST failed with status %d", err.statusCode);
        console.log(err)
    });
  }

  _getKey(coordinates) {
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
      url: this._buildUrl('indexes'),
      headers: this._getHeaders(),
      body,
      withCredentials: false,
      resolveWithFullResponse: true
    })
    .then(function (res) {
        console.log("POST returned with status %d", handleResponseCodes(res.statusCode));
    })
    .catch(function (err) {
        console.log("POST failed with status %d", err.statusCode);
        console.log(err)
    });
  }

  function handleResponseCodes(statusCode){
      switch (statusCode) {
      case 200:
          text = "200 OK - Success";
          break;
      case 207:
          text = "207 - At least one item was not successfully indexed";
          break;
      case 429:
          text = "429 - You have exceeded your quota on the number of documents per index.";
          break;
      case 503:
          text = "503 -The system is under heavy load and your request can't be processed at this time.";
          break;
      }
      return text;
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
