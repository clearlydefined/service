// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { createClient } = require('redis')
const pako = require('pako')
const logger = require('../logging/logger')

const objectPrefix = '*!~%'

class RedisCache {
  constructor(options) {
    this.options = options
    this.logger = options.logger || logger()
  }

  // Initialize the Redis client and return a promise
  async initialize() {
    if (this._client) return Promise.resolve()
    if (!this._clientReady) {
      this._clientReady = RedisCache.initializeClient(this.options, this.logger)
        .then(client => {
          this._client = client
        })
        .catch(error => {
          this._clientReady = null
          throw error
        })
    }
    return this._clientReady
  }

  async done() {
    const client = this._client
    this._client = null
    return client?.quit()
  }

  get client() {
    return this._client
  }

  async get(item) {
    const cacheItem = await this._client.get(item)
    if (!cacheItem) return null
    const result = pako.inflate(cacheItem, { to: 'string' })
    if (!result.startsWith(objectPrefix)) return result
    try {
      return JSON.parse(result.substring(4))
    } catch (error) {
      this.logger.error('Error parsing cached item: %s', error)
      return null
    }
  }

  async set(item, value, ttlSeconds) {
    if (typeof value !== 'string') value = objectPrefix + JSON.stringify(value)
    const data = pako.deflate(value, { to: 'string' })
    if (ttlSeconds) await this._client.set(item, data, { EX: ttlSeconds })
    else await this._client.set(item, data)
  }

  async delete(item) {
    await this._client.del(item)
  }

  static buildRedisClient({ apiKey, service, port = 6380, tls = true }) {
    return createClient({
      username: 'default',
      password: apiKey,
      socket: { host: service, port, tls },
      pingInterval: 5 * 60 * 1000 // https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-connection#idle-timeout
    })
  }

  static async initializeClient(options, logger) {
    const client = this.buildRedisClient(options)
    try {
      await client.connect()
      logger.info('Done connecting to redis: %s', options.service)
      client.on('error', error => {
        logger.error(`Redis client error: ${error}`)
      })
      return client
    } catch (error) {
      logger.error('Error connecting to redis: %s', error)
      throw error
    }
  }
}

module.exports = options => new RedisCache(options)
module.exports.RedisCache = RedisCache
