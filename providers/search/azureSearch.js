// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')
const AbstractSearch = require('./abstractSearch')

const serviceUrlTemplate = 'https://$service$.search.windows.net'
const apiVersion = '2019-05-06'
const definitionsIndexName = 'definitions'
const definitionsDataSourceName = 'definitionsdatasource'
const definitionsIndexerName = 'definitionsindexer'

class AzureSearch extends AbstractSearch {
  async initialize() {
    super.initialize()
    if (!(await this._hasIndex(definitionsIndexName))) await this._createIndex(this._buildDefinitionsIndex())
    if (!(await this._hasDataSource(definitionsDataSourceName))) await this._createDataSource(this._buildDataSource())
    if (!(await this._hasIndexer(definitionsIndexerName))) await this._createIndexer(this._buildIndexer())
  }

  /**
   * Get a list of coordinates suggested for the given pattern
   * @param {String} pattern - A pattern to look for in the coordinates of a definition
   * @returns {String[]} The list of suggested coordinates found
   */
  async suggestCoordinates(pattern) {
    const baseUrl = this._buildUrl(`indexes/${definitionsIndexName}/docs/suggest`)
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
   * Query the search index. See https://docs.microsoft.com/en-us/rest/api/searchservice/search-documents#request-body
   * @param {object} body - the request body to send to search
   * @returns {String[]} The search response. See https://docs.microsoft.com/en-us/rest/api/searchservice/search-documents#response
   */
  async query(body) {
    return requestPromise({
      method: 'POST',
      url: this._buildUrl(`indexes/${definitionsIndexName}/docs/search`),
      headers: this._getHeaders(),
      withCredentials: false,
      json: true,
      body
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

  _buildDefinitionsIndex() {
    return {
      name: definitionsIndexName,
      fields: [
        {
          name: 'id',
          type: 'Edm.String',
          key: true,
          searchable: false,
          filterable: false,
          retrievable: true,
          sortable: true,
          facetable: false
        },
        {
          name: 'coordinates',
          type: 'Edm.String',
          searchable: false,
          filterable: false,
          retrievable: true,
          sortable: true,
          facetable: false
        },
        {
          name: 'type',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'provider',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'namespace',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'name',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'revision',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'effectiveScore',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'toolScore',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'describedScore',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'describedScoreDate',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'describedScoreSource',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScore',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScoreDeclared',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScoreDiscovered',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScoreConsistency',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScoreSpdx',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'licensedScoreTexts',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'sourceLocation',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'fileCount',
          type: 'Edm.Int32',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'releaseDate',
          type: 'Edm.DateTimeOffset',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'projectWebsite',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'issueTracker',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'tools',
          type: 'Collection(Edm.String)',
          searchable: false,
          filterable: true,
          retrievable: true,
          sortable: false,
          facetable: true
        },
        {
          name: 'declaredLicense',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: true,
          facetable: true
        },
        {
          name: 'discoveredLicenses',
          type: 'Collection(Edm.String)',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: false,
          facetable: true
        },
        {
          name: 'copyrights',
          type: 'Collection(Edm.String)',
          searchable: true,
          filterable: false,
          retrievable: true,
          sortable: false,
          facetable: false
        }
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

  _buildDataSource() {
    return {
      name: definitionsDataSourceName,
      type: 'azureblob',
      credentials: {
        connectionString: this.options.dataSourceConnectionString
      },
      container: { name: this.options.dataSourceContainerName }
    }
  }

  _createDataSource(body) {
    return requestPromise({
      method: 'POST',
      url: this._buildUrl('datasources'),
      headers: this._getHeaders(),
      body,
      withCredentials: false,
      json: true
    })
  }

  async _hasDataSource(name) {
    const dataSource = await requestPromise({
      method: 'GET',
      url: this._buildUrl(`datasources/${name}`),
      headers: this._getHeaders(),
      withCredentials: false,
      simple: false,
      resolveWithFullResponse: true,
      json: true
    })
    return dataSource.statusCode === 200
  }

  _buildIndexer() {
    return {
      name: definitionsIndexerName,
      dataSourceName: definitionsDataSourceName,
      targetIndexName: definitionsIndexName,
      schedule: { interval: 'PT1H' },
      parameters: { configuration: { parsingMode: 'json', indexStorageMetadataOnlyForOversizedDocuments: true } },
      fieldMappings: [
        { sourceFieldName: 'id', targetFieldName: 'id', mappingFunction: { name: 'base64Encode' } },
        { sourceFieldName: 'id', targetFieldName: 'coordinates' },
        { sourceFieldName: '/coordinates/type', targetFieldName: 'type' },
        { sourceFieldName: '/coordinates/provider', targetFieldName: 'provider' },
        { sourceFieldName: '/coordinates/namespace', targetFieldName: 'namespace' },
        { sourceFieldName: '/coordinates/name', targetFieldName: 'name' },
        { sourceFieldName: '/coordinates/revision', targetFieldName: 'revision' },
        { sourceFieldName: '/scores/effective', targetFieldName: 'effectiveScore' },
        { sourceFieldName: '/scores/tool', targetFieldName: 'toolScore' },
        { sourceFieldName: '/described/score/total', targetFieldName: 'describedScore' },
        { sourceFieldName: '/described/score/date', targetFieldName: 'describedScoreDate' },
        { sourceFieldName: '/described/score/source', targetFieldName: 'describedScoreSource' },
        { sourceFieldName: '/licensed/score/total', targetFieldName: 'licensedScore' },
        { sourceFieldName: '/licensed/score/declared', targetFieldName: 'licensedScoreDeclared' },
        { sourceFieldName: '/licensed/score/discovered', targetFieldName: 'licensedScoreDiscovered' },
        { sourceFieldName: '/licensed/score/consistency', targetFieldName: 'licensedScoreConsistency' },
        { sourceFieldName: '/licensed/score/spdx', targetFieldName: 'licensedScoreSpdx' },
        { sourceFieldName: '/licensed/score/texts', targetFieldName: 'licensedScoreTexts' },
        { sourceFieldName: '/described/sourceLocation/url', targetFieldName: 'sourceLocation' },
        { sourceFieldName: '/described/files', targetFieldName: 'fileCount' },
        { sourceFieldName: '/described/releaseDate', targetFieldName: 'releaseDate' },
        { sourceFieldName: '/described/projectWebsite', targetFieldName: 'projectWebsite' },
        { sourceFieldName: '/described/issueTracker', targetFieldName: 'issueTracker' },
        { sourceFieldName: '/described/tools', targetFieldName: 'tools' },
        { sourceFieldName: '/licensed/declared', targetFieldName: 'declaredLicense' },
        { sourceFieldName: '/licensed/facets/core/discovered/expressions', targetFieldName: 'discoveredLicenses' },
        { sourceFieldName: '/licensed/facets/core/attribution/parties', targetFieldName: 'copyrights' }
      ]
    }
  }

  _createIndexer(body) {
    return requestPromise({
      method: 'POST',
      url: this._buildUrl('indexers'),
      headers: this._getHeaders(),
      body,
      withCredentials: false,
      json: true
    })
  }

  async _hasIndexer(name) {
    const indexer = await requestPromise({
      method: 'GET',
      url: this._buildUrl(`indexers/${name}`),
      headers: this._getHeaders(),
      withCredentials: false,
      simple: false,
      resolveWithFullResponse: true,
      json: true
    })
    return indexer.statusCode === 200
  }
}

module.exports = options => new AzureSearch(options)
