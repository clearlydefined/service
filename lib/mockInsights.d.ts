// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { TelemetryClient, Contracts } from 'applicationinsights'

/** Mock implementation of Application Insights client for testing and development */
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
   * Sets up the mock insights client or configures Application Insights
   *
   * @param key - Application Insights instrumentation key or 'mock' for testing
   * @param echo - Whether to echo telemetry to both mock and real client
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
