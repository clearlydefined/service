// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Logger } from './index.js'

/** Global logger instance storage */
let logger: Logger | undefined

/**
 * Logger factory function that manages a singleton logger instance. This function follows the singleton pattern - it
 * accepts a logger instance on first call to initialize the global logger, and returns the stored logger instance on
 * subsequent calls.
 *
 * @example
 *   // Initialize the logger with a Winston instance
 *   const winston = require('winston')
 *   const loggerFactory = require('./logger')
 *   const myLogger = loggerFactory(winston.createLogger())
 *
 * @example
 *   // Get the existing logger instance
 *   const loggerFactory = require('./logger')
 *   const logger = loggerFactory()
 *   logger.info('Hello world')
 *
 * @param loggerValue - Optional logger instance to set as the global logger. If provided and no logger is
 *   currently set, this becomes the global logger. If not provided, returns the existing global logger.
 * @throws {Error} If no logger has been initialized and none is provided
 */
export default (loggerValue?: Logger): Logger => {
  if (loggerValue && !logger) {
    logger = loggerValue
  }
  if (!logger) {
    throw new Error('Logger not initialized. Please provide a logger instance on first call.')
  }
  return logger
}
