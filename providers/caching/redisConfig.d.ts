// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { RedisCache, RedisCacheOptions } from './redis'

/**
 * Factory function that creates a Redis cache instance with configuration from environment variables or provided
 * options
 *
 * @param options - Optional configuration options. If not provided, will use environment variables
 * @returns A new RedisCache instance configured with the provided or default options
 */
declare function redisConfigFactory(options?: RedisCacheOptions): RedisCache

export default redisConfigFactory
