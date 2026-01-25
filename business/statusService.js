// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./statusService').StatusServiceOptions} StatusServiceOptions
 * @typedef {import('./statusService').StatusData} StatusData
 * @typedef {import('./statusService').StatusKey} StatusKey
 * @typedef {import('./statusService').StatusLookupFn} StatusLookupFn
 * @typedef {import('./statusService').RequestCountData} RequestCountData
 * @typedef {import('./statusService').ProcessedPerDayEntry} ProcessedPerDayEntry
 * @typedef {import('./statusService').RecentlyCrawledEntry} RecentlyCrawledEntry
 * @typedef {import('./statusService').CrawlBreakdownEntry} CrawlBreakdownEntry
 * @typedef {import('./statusService').ToolsRanPerDayEntry} ToolsRanPerDayEntry
 * @typedef {import('../providers/caching').ICache} ICache
 * @typedef {import('../providers/logging').Logger} Logger
 */

const { callFetch: requestPromise } = require('../lib/fetch')
const logger = require('../providers/logging/logger')

/**
 * Service for retrieving system status information from Application Insights.
 * Provides various metrics about system usage and crawler activity.
 */
class StatusService {
  /**
   * Creates a new StatusService instance
   * @param {StatusServiceOptions} options - Configuration options for Application Insights
   * @param {ICache} cache - Cache for storing results
   */
  constructor(options, cache) {
    this.options = options
    /** @type {Logger} */
    this.logger = logger()
    this.cache = cache
    this.statusLookup = this._getStatusLookup()
  }

  /**
   * Get status data for a specific key
   * @param {string} key - The status key to retrieve
   * @returns {Promise<StatusData>} The status data
   * @throws {Error} If key is not found or if an unexpected error occurs
   */
  async get(key) {
    key = key.toLowerCase()
    if (!this.statusLookup[key]) throw new Error('Not found')
    try {
      const cacheKey = this._getCacheKey(key)
      const cached = await this.cache.get(cacheKey)
      if (cached) return cached
      const result = await this.statusLookup[key].bind(this)()
      if (result) await this.cache.set(cacheKey, result, 60 * 60 /* 1h */)
      return result
    } catch (error) {
      this.logger.error(`Status service failed for ${key}`, error)
      throw new Error('unexpected error')
    }
  }

  /**
   * List all available status keys
   * @returns {string[]} Array of available status keys
   */
  list() {
    return Object.keys(this.statusLookup)
  }

  /**
   * Get the status lookup table
   * @returns {Record<string, StatusLookupFn>} The status lookup table
   * @private
   */
  _getStatusLookup() {
    return {
      requestcount: this._requestCount,
      processedperday: this._processedPerDay,
      recentlycrawled: this._recentlyCrawled,
      crawlbreakdown: this._crawlbreakdown,
      toolsranperday: this._toolsranperday
    }
  }

  /**
   * Get request count data for the last 90 days
   * @returns {Promise<RequestCountData>} Request counts by date
   * @private
   */
  async _requestCount() {
    const data = await requestPromise(
      this._serviceQuery(`
      requests
      | where timestamp > ago(90d)
      | summarize count() by bin(timestamp, 1d)
      | order by timestamp asc`)
    )
    return data.tables[0].rows.reduce(
      /**
       * @param {RequestCountData} result
       * @param {any[]} row
       */
      (result, row) => {
        result[row[0]] = row[1]
        return result
      },
      /** @type {RequestCountData} */ ({})
    )
  }

  /**
   * Get processed items per day for the last 90 days
   * @returns {Promise<ProcessedPerDayEntry[]>} Processed counts by date and host
   * @private
   */
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
    /** @type {Record<string, Record<string, number>>} */
    const grouped = data.tables[0].rows.reduce(
      /**
       * @param {Record<string, Record<string, number>>} result
       * @param {any[]} row
       */
      (result, row) => {
        let date = row[0]
        result[date] = result[date] || {}
        result[date][row[1]] = row[2]
        return result
      },
      /** @type {Record<string, Record<string, number>>} */ ({})
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  /**
   * Get recently crawled items from the last day
   * @returns {Promise<RecentlyCrawledEntry[]>} Recently crawled items
   * @private
   */
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
    return data.tables[0].rows.map(
      /** @param {any[]} row */
      row => {
        return { coordinates: row[0], timestamp: row[1] }
      }
    )
  }

  /**
   * Get crawl breakdown by tool and type for the last 90 days
   * @returns {Promise<CrawlBreakdownEntry[]>} Crawl breakdown data
   * @private
   */
  async _crawlbreakdown() {
    const data = await requestPromise(
      this._crawlerQuery(`
      traces
      | where timestamp > ago(90d) 
      | where customDimensions.outcome == 'Processed'  
      | where strlen(customDimensions.crawlerHost) > 0
      | parse message with "Processed " tool "@cd:/" type "/" specTrail 
      | summarize count() by when=bin(timestamp, 1d), tool, type
      | order by when asc, type`)
    )
    /** @type {Record<string, Record<string, Record<string, number>>>} */
    const grouped = data.tables[0].rows.reduce(
      /**
       * @param {Record<string, Record<string, Record<string, number>>>} result
       * @param {any[]} row
       */
      (result, row) => {
        let date = row[0]
        let tool = row[1]
        let type = row[2]
        let count = row[3]
        result[date] = result[date] || {}
        result[date][tool] = result[date][tool] || {}
        result[date][tool][type] = count
        return result
      },
      /** @type {Record<string, Record<string, Record<string, number>>>} */ ({})
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  /**
   * Get tools ran per day for the last 90 days
   * @returns {Promise<ToolsRanPerDayEntry[]>} Tools ran per day data
   * @private
   */
  async _toolsranperday() {
    const data = await requestPromise(
      this._crawlerQuery(`
      traces
      | where timestamp > ago(90d) 
      | where customDimensions.outcome == 'Processed'  
      | where strlen(customDimensions.crawlerHost) > 0
      | parse message with "Processed " tool "@cd:/" type "/" specTrail 
      | summarize count() by when=bin(timestamp, 1d), tool
      | order by when asc, tool`)
    )
    /** @type {Record<string, Record<string, number>>} */
    const grouped = data.tables[0].rows.reduce(
      /**
       * @param {Record<string, Record<string, number>>} result
       * @param {any[]} row
       */
      (result, row) => {
        let date = row[0]
        let tool = row[1]
        let count = row[2]
        result[date] = result[date] || {}
        result[date][tool] = count
        return result
      },
      /** @type {Record<string, Record<string, number>>} */ ({})
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  /**
   * Build a query options object for the service Application Insights
   * @param {string} query - The Kusto query
   * @returns {Object} The fetch options
   * @private
   */
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

  /**
   * Build a query options object for the crawler Application Insights
   * @param {string} query - The Kusto query
   * @returns {Object} The fetch options
   * @private
   */
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

  /**
   * Generate a cache key for the given status key
   * @param {string} key - The status key
   * @returns {string} The cache key
   * @private
   */
  _getCacheKey(key) {
    return `status_${key.toLowerCase()}`
  }
}

/**
 * Factory function to create a StatusService instance
 * @param {StatusServiceOptions} options - Configuration options for Application Insights
 * @param {ICache} cache - Cache for storing results
 * @returns {StatusService} A new StatusService instance
 */
module.exports = (options, cache) => new StatusService(options, cache)
