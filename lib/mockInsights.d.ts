// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { TelemetryClient, Contracts } from 'applicationinsights'

/** Application Insights abstraction layer that provides a consistent interface for telemetry operations */
declare class MockInsights {
  /** The underlying Application Insights client, if any */
  client: TelemetryClient | null

  /**
   * Creates a new MockInsights instance
   *
   * @param client - Optional Application Insights client to wrap
   */
  constructor(client?: TelemetryClient | null)

  /**
   * Sets up the Application Insights abstraction layer
   *
   * @param key - Application Insights instrumentation key. If null, undefined, or 'mock', uses console-based logging
   * @param echo - Whether to echo telemetry to both console and Application Insights client when both are available
   */
  static setup(key?: string | null, echo?: boolean): void

  /**
   * Tracks an exception
   *
   * @param exceptionTelemetry - The exception telemetry data
   */
  trackException(exceptionTelemetry: Contracts.ExceptionTelemetry): void

  /**
   * Tracks a trace message
   *
   * @param traceTelemetry - The trace telemetry data
   */
  trackTrace(traceTelemetry: Contracts.TraceTelemetry): void
}

export = MockInsights
