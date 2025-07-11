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
   * Sets up the Application Insights abstraction layer. This method configures the global Application Insights client
   * based on the provided key, creating either a full Application Insights client or a console-based fallback wrapper.
   *
   * @param {string | null} [key=null] - Application Insights instrumentation key. If null, undefined, or 'mock', uses
   *   console-based logging. Default is `null`
   * @param {boolean} [echo=false] - Whether to echo telemetry to both console and Application Insights client when both
   *   are available. Default is `false`
   * @returns {void}
   */
  static setup(key = null, echo = false) {
    // exit if we we are already setup
    if (appInsights.defaultClient instanceof MockInsights) return
    if (!key || key === 'mock') appInsights.defaultClient = /** @type {any} */ (new MockInsights())
    else {
      appInsights.setup(key).setAutoCollectPerformance(false).setAutoCollectDependencies(true).start()
      if (echo) appInsights.defaultClient = /** @type {any} */ (new MockInsights(appInsights.defaultClient))
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
    // const severities = ['Verbose', 'Info', 'Warning', 'Error', 'Critical'];
    const severities = ['V', 'I', 'W', 'E', 'C']
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? `${JSON.stringify(traceTelemetry.properties)}` : ''
    console.log(`[${severities[traceTelemetry.severity]}] ${traceTelemetry.message}${propertyString}`)
    if (this.client) this.client.trackTrace(traceTelemetry)
  }
}
module.exports = MockInsights
