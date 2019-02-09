// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const redis = require('redis')
const util = require('util')
const pako = require('pako')

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
    this._redisDel = util.promisify(this.redis.del).bind(this.redis)
  }

  async get(item) {
    const cacheItem = await this._redisGet(item)
    if (!cacheItem) return null
    const result = pako.inflate(cacheItem, { to: 'string' })
    if (result.startsWith(objectPrefix)) {
      try {
        return JSON.parse(result.substring(4))
      } catch (error) {
        return null
      }
    }
    return result
  }

  async set(item, value, expirationSeconds) {
    if (typeof value !== 'string') value = objectPrefix + JSON.stringify(value)
    const data = pako.deflate(value, { to: 'string' })
    if (expirationSeconds) await this._redisSet(item, data, 'EX', expirationSeconds)
    else await this._redisSet(item, data)
  }

  async delete(item) {
    await this._redisDel(item)
  }
}

module.exports = options => new RedisCache(options)
