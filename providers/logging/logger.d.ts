// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

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
