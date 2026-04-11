// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { Logger } from '../../logging/index.js'
import loggerFactory from '../../logging/logger.ts'
import ListBasedFilter from './listBasedFilter.ts'

function parseListEnv(value: string | undefined, logger: Logger): string[] {
  if (!value || value.trim() === '') {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      throw new Error('Not an array')
    }
    return parsed
  } catch (e) {
    logger.warn(`Blacklist configuration invalid, using empty list: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }
}

function throttlerFactory(listSpec?: string): ListBasedFilter {
  const listEnv = listSpec || config.get('HARVEST_THROTTLER_BLACKLIST')
  const logger = loggerFactory()
  const blacklist = parseListEnv(listEnv, logger)
  return new ListBasedFilter({ blacklist, logger })
}

export default throttlerFactory
