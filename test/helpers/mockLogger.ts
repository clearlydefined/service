// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import sinon from 'sinon'
import type { Logger } from '../../providers/logging/index.js'

/** Sinon-stubbed version of the Logger interface for test assertions */
export interface StubbedLogger extends Logger {
  info: sinon.SinonStub
  error: sinon.SinonStub
  warn: sinon.SinonStub
  debug: sinon.SinonStub
  log: sinon.SinonStub
}

/** Creates a fully stubbed Logger instance for use in tests */
export function createMockLogger(): StubbedLogger {
  return {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
    debug: sinon.stub(),
    log: sinon.stub()
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
