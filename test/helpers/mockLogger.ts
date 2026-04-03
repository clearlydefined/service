// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { mock } from 'node:test'
import type { Logger } from '../../providers/logging/index.js'

/** Mock version of the Logger interface for test assertions */
export interface MockedLogger extends Logger {
  info: ReturnType<typeof mock.fn>
  error: ReturnType<typeof mock.fn>
  warn: ReturnType<typeof mock.fn>
  debug: ReturnType<typeof mock.fn>
  log: ReturnType<typeof mock.fn>
}

/** Creates a fully mocked Logger instance for use in tests */
export function createMockLogger(): MockedLogger {
  return {
    info: mock.fn(),
    error: mock.fn(),
    warn: mock.fn(),
    debug: mock.fn(),
    log: mock.fn()
  }
}

/** Creates a silent no-op Logger for tests that don't need to assert on logging */
export function createSilentLogger(): Logger {
  return {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    log: () => {}
  }
}
