// (c) Copyright 2025, Microsoft Corporation and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Generic logger interface that represents the logging functionality expected by the application. This interface is
 * typically implemented by Winston logger instances.
 */
export interface Logger {
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
