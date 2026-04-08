// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type * as winston from 'winston'

/** Configuration options for creating a Winston logger instance. */
export interface WinstonLoggerOptions {
  /**
   * Application Insights connection string for logging. If not provided, uses APPLICATIONINSIGHTS_CONNECTION_STRING
   * from config.
   */
  connectionString?: string

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
declare function factory(options?: WinstonLoggerOptions): winston.Logger

export default factory

/** Sanitize sensitive HTTP headers by redacting their values. */
export function sanitizeHeaders(headers: Record<string, string> | null | undefined): Record<string, string>

/** Winston format that sanitizes metadata to prevent circular JSON errors. */
export function sanitizeMeta(): winston.Logform.Format

/**
 * Rehydrate null-prototype objects in log properties so AppInsights can serialize them.
 */
export function buildProperties(info: Record<string, any>): Record<string, any>
