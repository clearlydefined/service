// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from '../providers/caching/index.js'
import type { Logger } from '../providers/logging/index.js'

import { callFetch as requestPromise } from '../lib/fetch.ts'
import logger from '../providers/logging/logger.ts'

/** Options for the StatusService */
export interface StatusServiceOptions {
  serviceId: string
  serviceKey: string
  crawlerId: string
  crawlerKey: string
}

/** Request count data - date to count mapping */
export type RequestCountData = Record<string, number>

/** Processed per day entry */
export interface ProcessedPerDayEntry {
  date: string
  [host: string]: string | number
}

/** Recently crawled entry */
export interface RecentlyCrawledEntry {
  coordinates: string
  timestamp: string
}

/** Crawl breakdown entry */
export interface CrawlBreakdownEntry {
  date: string
  [tool: string]: string | Record<string, number>
}

/** Tools ran per day entry */
export interface ToolsRanPerDayEntry {
  date: string
  [tool: string]: string | number
}

/** Available status keys */
export type StatusKey = 'requestcount' | 'processedperday' | 'recentlycrawled' | 'crawlbreakdown' | 'toolsranperday'

/** Status data union type */
export type StatusData =
  | RequestCountData
  | ProcessedPerDayEntry[]
  | RecentlyCrawledEntry[]
  | CrawlBreakdownEntry[]
  | ToolsRanPerDayEntry[]

/** Status lookup function type */
export type StatusLookupFn = () => Promise<StatusData>

/**
 * Service for retrieving system status information from Application Insights.
 * Provides various metrics about system usage and crawler activity.
 */
class StatusService {
  options: StatusServiceOptions
  logger: Logger
  cache: ICache
  statusLookup: Record<string, StatusLookupFn>

  constructor(options: StatusServiceOptions, cache: ICache) {
    this.options = options
    this.logger = logger()
    this.cache = cache
    this.statusLookup = this._getStatusLookup()
  }

  async get(key: string): Promise<StatusData> {
    key = key.toLowerCase()
    if (!this.statusLookup[key]) {
      throw new Error('Not found')
    }
    try {
      const cacheKey = this._getCacheKey(key)
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        return cached
      }
      const result = await this.statusLookup[key].bind(this)()
      if (result) {
        await this.cache.set(cacheKey, result, 60 * 60 /* 1h */)
      }
      return result
    } catch (error) {
      this.logger.error(`Status service failed for ${key}`, error)
      throw new Error('unexpected error', { cause: error })
    }
  }

  list(): StatusKey[] {
    return Object.keys(this.statusLookup) as StatusKey[]
  }

  _getStatusLookup(): Record<string, StatusLookupFn> {
    return {
      requestcount: this._requestCount,
      processedperday: this._processedPerDay,
      recentlycrawled: this._recentlyCrawled,
      crawlbreakdown: this._crawlbreakdown,
      toolsranperday: this._toolsranperday
    }
  }

  async _requestCount(): Promise<RequestCountData> {
    const data = await requestPromise(
      this._serviceQuery(`
      requests
      | where timestamp > ago(90d)
      | summarize count() by bin(timestamp, 1d)
      | order by timestamp asc`)
    )
    return data.tables[0].rows.reduce(
      (result: RequestCountData, row: any[]) => {
        result[row[0]] = row[1]
        return result
      },
      {} as RequestCountData
    )
  }

  async _processedPerDay(): Promise<ProcessedPerDayEntry[]> {
    const data = await requestPromise(
      this._crawlerQuery(`
      traces
      | where timestamp > ago(90d)
      | where strlen(customDimensions.crawlerHost) > 0
      | where customDimensions.outcome == 'Processed'
      | summarize count() by bin(timestamp, 1d) , tostring(customDimensions.crawlerHost)
      | order by timestamp asc`)
    )
    const grouped: Record<string, Record<string, number>> = data.tables[0].rows.reduce(
      (result: Record<string, Record<string, number>>, row: any[]) => {
        const date = row[0]
        result[date] = result[date] || {}
        result[date][row[1]] = row[2]
        return result
      },
      {} as Record<string, Record<string, number>>
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  async _recentlyCrawled(): Promise<RecentlyCrawledEntry[]> {
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
      (row: any[]) => {
        return { coordinates: row[0], timestamp: row[1] }
      }
    )
  }

  async _crawlbreakdown(): Promise<CrawlBreakdownEntry[]> {
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
    const grouped: Record<string, Record<string, Record<string, number>>> = data.tables[0].rows.reduce(
      (result: Record<string, Record<string, Record<string, number>>>, row: any[]) => {
        const date = row[0]
        const tool = row[1]
        const type = row[2]
        const count = row[3]
        result[date] = result[date] || {}
        result[date][tool] = result[date][tool] || {}
        result[date][tool][type] = count
        return result
      },
      {} as Record<string, Record<string, Record<string, number>>>
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  async _toolsranperday(): Promise<ToolsRanPerDayEntry[]> {
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
    const grouped: Record<string, Record<string, number>> = data.tables[0].rows.reduce(
      (result: Record<string, Record<string, number>>, row: any[]) => {
        const date = row[0]
        const tool = row[1]
        const count = row[2]
        result[date] = result[date] || {}
        result[date][tool] = count
        return result
      },
      {} as Record<string, Record<string, number>>
    )
    return Object.keys(grouped).map(date => {
      return { ...grouped[date], date }
    })
  }

  _serviceQuery(query: string): object {
    return {
      method: 'POST',
      url: `https://api.applicationinsights.io/v1/apps/${this.options.serviceId}/query`,
      headers: { 'X-Api-Key': this.options.serviceKey, 'Content-Type': 'application/json; charset=utf-8' },
      body: { query },
      withCredentials: false,
      json: true
    }
  }

  _crawlerQuery(query: string): object {
    return {
      method: 'POST',
      url: `https://api.applicationinsights.io/v1/apps/${this.options.crawlerId}/query`,
      headers: { 'X-Api-Key': this.options.crawlerKey, 'Content-Type': 'application/json; charset=utf-8' },
      body: { query },
      withCredentials: false,
      json: true
    }
  }

  _getCacheKey(key: string): string {
    return `status_${key.toLowerCase()}`
  }
}

export default (options: StatusServiceOptions, cache: ICache): StatusService => new StatusService(options, cache)
