// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const requestPromise = require('request-promise-native')

class StatusService {
  constructor(options) {
    this.options = options
    this.statusLookup = this._getStatusLookup()
  }

  async get(key) {
    key = key.toLowerCase()
    if (!this.statusLookup[key]) throw new Error('Not found')
    try {
      return this.statusLookup[key].bind(this)()
    } catch (error) {
      this.logger.error(`Status service failed for ${key}`, error)
      throw new Error('unexpected error')
    }
  }

  list() {
    return Object.keys(this.statusLookup)
  }

  _getStatusLookup() {
    return {
      requestcount: this._requestCount,
      definitionavailability: this._definitionAvailability,
      processedperday: this._processedPerDay,
      recentlycrawled: this._recentlyCrawled
    }
  }

  async _requestCount() {
    const data = await requestPromise(
      this._serviceQuery(`
      requests
      | where timestamp > ago(90d)
      | summarize count() by bin(timestamp, 1d)
      | order by timestamp asc`)
    )
    return data.tables[0].rows.reduce((result, row) => {
      result[row[0]] = row[1]
      return result
    }, {})
  }

  async _definitionAvailability() {
    const data = await requestPromise(
      this._serviceQuery(`
      traces
      | where timestamp > ago(90d)
      | where message == "recomputed definition available" or message == "definition not available"  or message == "computed definition available"
      | summarize count() by message`)
    )
    return data.tables[0].rows.reduce((result, row) => {
      result[row[0]] = row[1]
      return result
    }, {})
  }

  async _processedPerDay() {
    const data = await requestPromise(
      this._crawlerQuery(`
      traces
      | where timestamp > ago(90d)
      | where strlen(customDimensions.crawlerHost) > 0
      | where customDimensions.outcome == 'Processed'
      | summarize count() by bin(timestamp, 1d) , tostring(customDimensions.crawlerHost)
      | order by timestamp asc`)
    )
    const grouped = data.tables[0].rows.reduce((result, row) => {
      let date = row[0]
      result[date] = result[date] || {}
      result[date][row[1]] = row[2]
      return result
    }, {})
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  async _recentlyCrawled() {
    const data = await requestPromise(
      this._crawlerQuery(`
      traces
      | where timestamp > ago(1d)
      | where strlen(customDimensions.crawlerHost) > 0
      | where customDimensions.outcome == 'Processed'
      | extend root = tostring(customDimensions.root)
      | parse root with type "@cd:/" coordinates
      | project coordinates, timestamp
      | summarize when=max(timestamp) by coordinates
      | order by when desc
      | take 50`)
    )
    return data.tables[0].rows.map(row => {
      return { coordinates: row[0], timestamp: row[1] }
    })
  }

  _serviceQuery(query) {
    return {
      method: 'POST',
      url: `https://api.applicationinsights.io/v1/apps/${this.options.serviceId}/query`,
      headers: { 'X-Api-Key': this.options.serviceKey, 'Content-Type': 'application/json; charset=utf-8' },
      body: { query },
      withCredentials: false,
      json: true
    }
  }

  _crawlerQuery(query) {
    return {
      method: 'POST',
      url: `https://api.applicationinsights.io/v1/apps/${this.options.crawlerId}/query`,
      headers: { 'X-Api-Key': this.options.crawlerKey, 'Content-Type': 'application/json; charset=utf-8' },
      body: { query },
      withCredentials: false,
      json: true
    }
  }
}

module.exports = options => new StatusService(options)