// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const aiLogger = require('winston-azure-application-insights').AzureApplicationInsightsLogger
const winston = require('winston')
const mockInsights = require('../../lib/mockInsights')

/** @typedef {import('./winstonConfig.d.ts').WinstonLoggerOptions} WinstonLoggerOptions */

/**
 * Factory function that creates a Winston logger instance configured with Application Insights.
 *
 * @param {WinstonLoggerOptions} [options] - Configuration options for the logger
 * @returns {winston.LoggerInstance} A configured Winston logger instance with Application Insights transport
 */
function factory(options) {
  const realOptions = options || {
    key: config.get('APPINSIGHTS_INSTRUMENTATIONKEY'),
    echo: false,
    level: config.get('APPINSIGHTS_EXPORT_LOG_LEVEL') || 'info'
  }
  mockInsights.setup(realOptions.key || 'mock', realOptions.echo)
  const result = new winston.Logger()
  result.add(aiLogger, {
    insights: appInsights,
    treatErrorsAsExceptions: true,
    exitOnError: false,
    level: realOptions.level
  })
  return result
}

module.exports = factory
