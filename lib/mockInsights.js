// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const appInsights = require('applicationinsights')

class MockInsights {
  constructor(client = null) {
    this.client = client
  }

  static setup(key = null, echo = false) {
    // exit if we we are already setup
    if (appInsights.defaultClient instanceof MockInsights) return
    if (!key || key === 'mock') appInsights.defaultClient = new MockInsights()
    else {
      appInsights
        .setup(key)
        .setAutoCollectPerformance(false)
        .setAutoCollectDependencies(true)
        .start()
      if (echo) appInsights.defaultClient = new MockInsights(appInsights.defaultClient)
    }
  }

  trackException(exceptionTelemetry) {
    console.log('Exception: ')
    console.dir(exceptionTelemetry.exception)
    if (this.client) this.client.trackException(exceptionTelemetry)
  }

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
