// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const mockInsights = require('../../lib/mockInsights')

/** @typedef {import('./winstonConfig.d.ts').WinstonLoggerOptions} WinstonLoggerOptions */

/**
 * Factory function to create a Winston logger instance.
 * @param {WinstonLoggerOptions} [options] - Configuration options for the logger.
 * @returns {winston.Logger} A configured Winston logger instance with Application Insights transport.
 */

function factory(options) {
  const realOptions = {
    key: config.get('APPINSIGHTS_INSTRUMENTATIONKEY'),
    echo: config.get('LOGGER_LOG_TO_CONSOLE') === 'true',
    level: config.get('APPINSIGHTS_EXPORT_LOG_LEVEL') || 'info',
    ...options
  }

  mockInsights.setup(realOptions.key || 'mock', realOptions.echo)

  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  )

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  )

  const logger = winston.createLogger({
    level: realOptions.level,
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
        silent: !realOptions.echo
      })
    ]
  })

  const aiClient = appInsights.defaultClient

  // Pipe Winston logs to Application Insights
  logger.on('data', info => {
    if (info.level === 'error') {
      if (info.stack) {
        aiClient.trackException({ exception: new Error(info.message), properties: info })
      } else {
        aiClient.trackTrace({
          message: info.message,
          severity: appInsights.Contracts.SeverityLevel.Error,
          properties: info
        })
      }
    } else {
      aiClient.trackTrace({ message: info.message, severity: mapLevel(info.level), properties: info })
    }
  })

  return logger
}

const levelMap = new Map([
  ['error', appInsights.Contracts.SeverityLevel.Error],
  ['warn', appInsights.Contracts.SeverityLevel.Warning],
  ['info', appInsights.Contracts.SeverityLevel.Information],
  ['verbose', appInsights.Contracts.SeverityLevel.Verbose],
  ['debug', appInsights.Contracts.SeverityLevel.Verbose],
  ['silly', appInsights.Contracts.SeverityLevel.Verbose]
])

/**
 * Maps Winston log levels to Application Insights severity levels
 * @param {string} level - The Winston log level
 * @returns {number} - The corresponding Application Insights severity level
 */
function mapLevel(level) {
  return levelMap.get(level) ?? appInsights.Contracts.SeverityLevel.Information
}

module.exports = factory
