// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const appInsights = require('applicationinsights')

/**
 * @typedef {import('applicationinsights').TelemetryClient} TelemetryClient
 *
 * @typedef {import('applicationinsights').Contracts.ExceptionTelemetry} ExceptionTelemetry
 *
 * @typedef {import('applicationinsights').Contracts.TraceTelemetry} TraceTelemetry
 */

/**
 * Module-level client reference. In applicationinsights 3.x, defaultClient is read-only,
 * so we maintain our own reference to the configured client.
 *
 * @type {TelemetryClient | MockInsights | null}
 */
let _client = null

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
}

/**
 * Application Insights abstraction layer that provides a consistent interface for telemetry operations regardless of
 * whether Application Insights is configured. This wrapper class can operate in production with or without an actual
 * Application Insights client, providing console-based fallback logging when no client is available.
 */
class MockInsights {
  /**
   * Creates a new MockInsights instance
   *
   * @param {TelemetryClient | null} [client=null] - Optional Application Insights client to wrap. Default is `null`
   */
  constructor(client = null) {
    /**
     * The underlying Application Insights client, if any
     *
     * @type {TelemetryClient | null}
     */
    this.client = client
  }

  /**
   * Gets the configured telemetry client. Returns the module-level client that was set up
   * via the setup() method.
   *
   * @returns {TelemetryClient | MockInsights | null} The configured client or null if not set up
   */
  static getClient() {
    return _client
  }

  /**
   * Sets up the Application Insights abstraction layer. This method configures the telemetry client
   * based on the provided connection string, creating either a full Application Insights client or a console-based fallback wrapper.
   *
   * @param {string | null} [connectionString=null] - Application Insights connection string. If null, undefined, or
   *   'mock', uses console-based logging. Default is `null`
   * @param {boolean} [echo=false] - Whether to echo telemetry to both console and Application Insights client when both
   *   are available. Default is `false`
   * @returns {void}
   */
  static setup(connectionString = null, echo = false) {
    // exit if we are already setup
    if (_client instanceof MockInsights) return
    if (!connectionString || connectionString === 'mock') {
      _client = new MockInsights()
    } else {
      appInsights.setup(connectionString).setAutoCollectPerformance(false).setAutoCollectDependencies(true).start()
      if (echo) {
        _client = new MockInsights(appInsights.defaultClient)
      } else {
        _client = appInsights.defaultClient
      }
    }
  }

  /**
   * Tracks an exception by logging it to the console and optionally forwarding to the underlying Application Insights
   * client if one is configured.
   *
   * @param {ExceptionTelemetry} exceptionTelemetry - The exception telemetry data
   * @returns {void}
   */
  trackException(exceptionTelemetry) {
    console.log('Exception: ')
    console.dir(exceptionTelemetry.exception)
    if (this.client) this.client.trackException(exceptionTelemetry)
  }

  /**
   * Tracks a trace message by logging it to the console and optionally forwarding to the underlying Application
   * Insights client if one is configured. The trace is formatted with severity level indicators for easy console
   * reading.
   *
   * @param {TraceTelemetry} traceTelemetry - The trace telemetry data
   * @returns {void}
   */
  trackTrace(traceTelemetry) {
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? `${JSON.stringify(traceTelemetry.properties)}` : ''
    const severity = /** @type {keyof typeof severityMap} */ (traceTelemetry.severity)
    const severityChar = severityMap[severity] || '?'
    console.log(`[${severityChar}] ${traceTelemetry.message}${propertyString}`)
    if (this.client) this.client.trackTrace(traceTelemetry)
  }
}
module.exports = MockInsights
