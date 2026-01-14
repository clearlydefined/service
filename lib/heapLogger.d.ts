// (c) Copyright 2024, Microsoft and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** Configuration for heap logging */
export interface HeapLoggerConfig {
  heapstats: {
    /** Set to 'true' to enable heap stats logging */
    logHeapstats?: string
    /** Logging interval in milliseconds (default: 30000) */
    logInverval?: string | number
  }
}

/** Logger interface for heap logging */
export interface HeapLogger {
  debug(message: string): void
  info(message: string): void
}

/**
 * Sets up periodic heap statistics logging if enabled via configuration.
 *
 * Enable by setting LOG_NODE_HEAPSTATS env var to 'true'.
 * Configure interval with LOG_NODE_HEAPSTATS_INTERVAL_MS env var.
 *
 * @param config - Configuration object with heapstats settings
 * @param logger - Logger instance for output
 */
declare function trySetHeapLoggingAtInterval(config: HeapLoggerConfig, logger: HeapLogger): void

export default trySetHeapLoggingAtInterval
export = trySetHeapLoggingAtInterval
