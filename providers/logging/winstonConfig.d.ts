// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import * as winston from 'winston'

/** Configuration options for creating a Winston logger instance. */
export interface WinstonLoggerOptions {
  /**
   * Application Insights instrumentation key for logging. If not provided, uses APPINSIGHTS_INSTRUMENTATIONKEY from
   * config.
   */
  key?: string

  /**
   * Whether to echo log messages to the console.
   *
   * @default false
   */
  echo?: boolean

  /**
   * The minimum log level to capture.
   *
   * @default 'info'
   */
  level?: string
}

/**
 * Factory function that creates a Winston logger instance configured with Application Insights.
 *
 * @param options - Configuration options for the logger
 * @returns A configured Winston logger instance
 */
declare function factory(options?: WinstonLoggerOptions): winston.LoggerInstance

export = factory
