// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Logger interface that represents the logging functionality expected by the application. This interface is typically
 * implemented by Winston logger instances.
 */
interface Logger {
  /**
   * Log an informational message
   *
   * @param message - The message to log
   * @param meta - Optional metadata object
   */
  info(message: string, meta?: any): void

  /**
   * Log an error message
   *
   * @param message - The error message to log
   * @param meta - Optional metadata object or Error instance
   */
  error(message: string, meta?: any): void

  /**
   * Log a warning message
   *
   * @param message - The warning message to log
   * @param meta - Optional metadata object
   */
  warn(message: string, meta?: any): void

  /**
   * Log a debug message
   *
   * @param message - The debug message to log
   * @param meta - Optional metadata object
   */
  debug(message: string, meta?: any): void

  /**
   * Log a general message
   *
   * @param level - The log level
   * @param message - The message to log
   * @param meta - Optional metadata object
   */
  log(level: string, message: string, meta?: any): void
}

/**
 * Logger factory function type that creates or returns a logger instance. If no logger is provided and one already
 * exists, returns the existing logger. If a logger is provided and none exists, sets and returns the provided logger.
 *
 * @param loggerValue - Optional logger instance to set as the global logger
 * @returns The global logger instance
 * @throws Error if no logger has been initialized and none is provided
 */
declare function loggerFactory(loggerValue?: Logger): Logger

declare namespace loggerFactory {
  export { Logger }
}

export = loggerFactory
