// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Express } from 'express'
import type { AppConfig } from './bin/config.ts'

/** Express application with an async initialization hook */
export interface App extends Express {
  init(app: App, callback: (error?: Error) => void): Promise<void>
}

/**
 * Creates and configures the Express application.
 *
 * Wires up all providers, services, routes, middleware, error handling,
 * and returns an {@link App} with an `init` method that must be called
 * to complete async initialization (stores, queues, queue processors, etc.).
 *
 * @param config - Application configuration (see `bin/config`)
 * @returns Configured Express application
 */
declare function createApp(config: AppConfig): App

export default createApp
