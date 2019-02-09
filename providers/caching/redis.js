// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const redis = require('redis')
const util = require('util')

const objectPrefix = '*!~%'

class RedisCache {
  constructor(options) {
    this.options = options
  }

  initialize() {
    this.redis = redis.createClient(6380, this.options.service, {
      auth_pass: this.options.apiKey,
      tls: { servername: this.options.service }
    })
    this._redisGet = util.promisify(this.redis.get).bind(this.redis)
    this._redisSet = util.promisify(this.redis.set).bind(this.redis)
  }

  async get(item) {
    const cacheItem = await this._redisGet(item)
    if (cacheItem && cacheItem.startsWith(objectPrefix)) {
      try {
        return JSON.parse(cacheItem.substring(4))
      } catch (error) {
        return null
      }
    }
    return cacheItem
  }

  async set(item, value, expirationSeconds) {
    if (typeof value !== 'string') value = objectPrefix + JSON.stringify(value)
    await this._redisSet(item, value, 'EX', expirationSeconds)
  }
}

module.exports = options => new RedisCache(options)
