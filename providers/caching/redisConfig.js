// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const redis = require('./redis')
const config = require('painless-config')

/**
 * @typedef {import('./redis.d.ts').RedisCacheOptions} RedisCacheOptions
 *
 * @typedef {import('./redis.d.ts').RedisCache} RedisCache
 */

/**
 * Factory function that creates a Redis cache instance with configuration from environment variables or provided
 * options. This function provides a convenient way to create Redis cache instances with sensible defaults while
 * allowing for custom configuration when needed.
 *
 * @param {RedisCacheOptions} [options] - Optional configuration options. If not provided, will use environment
 *   variables CACHING_REDIS_SERVICE and CACHING_REDIS_API_KEY
 * @returns {RedisCache} A new RedisCache instance configured with the provided or default options
 */
function serviceFactory(options) {
  const realOptions = options || {
    service: config.get('CACHING_REDIS_SERVICE'),
    apiKey: config.get('CACHING_REDIS_API_KEY')
  }
  return redis(realOptions)
}

module.exports = serviceFactory
