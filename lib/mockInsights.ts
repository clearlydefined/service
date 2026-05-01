// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Contracts, TelemetryClient } from 'applicationinsights'
import appInsights from 'applicationinsights'

/** Common interface for telemetry clients (real or mock). */
export interface InsightsClient {
  trackException(telemetry: Contracts.ExceptionTelemetry): void
  trackTrace(telemetry: Contracts.TraceTelemetry): void
}

/**
 * Module-level client reference. In applicationinsights 3.x, defaultClient is read-only,
 * so we maintain our own reference to the configured client.
 */
let _client: InsightsClient | null = null

/**
 * Mapping from KnownSeverityLevel string values to single-character abbreviations for console output.
 * In applicationinsights 3.x, severity is a string ('Verbose', 'Information', 'Warning', 'Error', 'Critical')
 * instead of a numeric enum.
 */
const severityMap = {
  Verbose: 'V',
  Information: 'I',
  Warning: 'W',
  Error: 'E',
  Critical: 'C'
} as const

/**
 * Application Insights abstraction layer that provides a consistent interface for telemetry operations
 * regardless of whether Application Insights is configured. Provides console-based fallback logging
 * when no client is available.
 */
export class MockInsights implements InsightsClient {
  client: TelemetryClient | null

  constructor(client: TelemetryClient | null = null) {
    this.client = client
  }

  static getClient(): InsightsClient | null {
    return _client
  }

  static setup(connectionString: string | null = null, echo = false): void {
    if (_client instanceof MockInsights) {
      return
    }
    if (!connectionString || connectionString === 'mock') {
      _client = new MockInsights()
    } else {
      appInsights
        .setup(connectionString ?? undefined)
        .setAutoCollectPerformance(false, false)
        .setAutoCollectDependencies(true)
        .start()
      if (echo) {
        _client = new MockInsights(appInsights.defaultClient)
      } else {
        _client = appInsights.defaultClient
      }
    }
  }

  trackException(exceptionTelemetry: Contracts.ExceptionTelemetry): void {
    console.log('Exception: ')
    console.dir(exceptionTelemetry.exception)
    if (this.client) {
      this.client.trackException(exceptionTelemetry)
    }
  }

  trackTrace(traceTelemetry: Contracts.TraceTelemetry): void {
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? `${JSON.stringify(traceTelemetry.properties)}` : ''
    const severity = traceTelemetry.severity as keyof typeof severityMap
    const severityChar = severityMap[severity] || '?'
    console.log(`[${severityChar}] ${traceTelemetry.message}${propertyString}`)
    if (this.client) {
      this.client.trackTrace(traceTelemetry)
    }
  }
}
