// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { RedisCache, RedisCacheOptions } from './redis.ts'
import redis from './redis.ts'

/**
 * Factory function that creates a Redis cache instance with configuration from environment variables or provided
 * options. This function provides a convenient way to create Redis cache instances with sensible defaults while
 * allowing for custom configuration when needed.
 */
function serviceFactory(options?: RedisCacheOptions): RedisCache {
  const realOptions: RedisCacheOptions = options || {
    service: config.get('CACHING_REDIS_SERVICE')!,
    apiKey: config.get('CACHING_REDIS_API_KEY')!,
    port: Number(config.get('CACHING_REDIS_PORT')) || 6380
  }
  return redis(realOptions)
}

export default serviceFactory
