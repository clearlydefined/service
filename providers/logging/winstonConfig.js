// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const mockInsights = require('../../lib/mockInsights')
const SENSITIVE_HEADERS = ['x-api-key', 'authorization', 'proxy-authorization', 'cookie']

/** @typedef {import('./winstonConfig.d.ts').WinstonLoggerOptions} WinstonLoggerOptions */

/**
 * Sanitizes headers by redacting sensitive values.
 * @param {Record<string, string> | null | undefined} headers
 * @returns {Record<string, string>}
 */
const sanitizeHeaders = headers =>
  Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) =>
      SENSITIVE_HEADERS.includes(key.toLowerCase()) ? [key, '<REDACTED>'] : [key, value]
    )
  )

/**
 * Winston format that sanitizes metadata to prevent circular JSON errors.
 * Summarizes HTTP request/response objects and Axios configs.
 */
const sanitizeMeta = winston.format(info => {
  // Summarize HTTP request
  if (info['req'] && typeof info['req'] === 'object') {
    const req = /** @type {any} */ (info['req'])
    info['req'] = {
      method: req['method'],
      url: req['originalUrl'] || req['url'],
      requestId: req['id'],
      correlationId: req['headers'] && req['headers']['x-correlation-id']
    }
  }

  // Summarize HTTP response
  if (info['res'] && typeof info['res'] === 'object') {
    const res = /** @type {any} */ (info['res'])
    info['res'] = {
      statusCode: res['statusCode']
    }
  }

  // Handle generic aliases
  if (info['request'] && !info['req']) {
    info['request'] = '[request omitted]'
  }
  if (info['response'] && !info['res']) {
    info['response'] = '[response omitted]'
  }

  // Summarize Axios config
  if (info['config'] && typeof info['config'] === 'object') {
    const cfg = /** @type {any} */ (info['config'])
    info['config'] = {
      method: cfg.method,
      url: cfg.url,
      headers: sanitizeHeaders(cfg.headers)
    }
  }

  return info
})

/**
 * AppInsights v3 internally accesses value.constructor.name when converting
 * telemetry properties to log records. Objects with a null prototype (e.g.,
 * Express req.params via Object.create(null)) lack .constructor, causing
 * TypeError. This function rehydrates such objects into plain Objects.
 * @param {Record<string, any>} info
 * @returns {Record<string, any>}
 */
function buildProperties(info) {
  return Object.fromEntries(
    Object.entries(info || {}).map(([key, value]) => {
      // Fix null-prototype objects
      if (value && typeof value === 'object' && Object.getPrototypeOf(value) === null) {
        // Rehydrate into a plain object with normal prototype
        try {
          value = Object.assign({}, value)
        } catch {
          // It is possible to have null‑prototype objects with throwing getters.
          // As a last resort, stringify
          try {
            value = JSON.stringify(value)
          } catch {
            value = '[unserializable object]'
          }
        }
      }
      return [key, value]
    })
  )
}

/**
 * Factory function to create a Winston logger instance.
 * @param {WinstonLoggerOptions} [options] - Configuration options for the logger.
 * @returns {winston.Logger} A configured Winston logger instance with Application Insights transport.
 */
function factory(options) {
  const realOptions = {
    connectionString: config.get('APPLICATIONINSIGHTS_CONNECTION_STRING'),
    echo: config.get('LOGGER_LOG_TO_CONSOLE') === 'true',
    level: config.get('APPINSIGHTS_EXPORT_LOG_LEVEL') || 'info',
    ...options
  }

  mockInsights.setup(realOptions.connectionString || 'mock', realOptions.echo)

  const logFormat = winston.format.combine(
    sanitizeMeta(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaKeys = Object.keys(meta)
      const metaString = metaKeys.length ? '\n' + JSON.stringify(meta, null, 2) : ''
      return `${timestamp} [${level}]: ${message}${metaString}`
    })
  )

  const consoleFormat = winston.format.combine(
    sanitizeMeta(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaKeys = Object.keys(meta)
      const metaString = metaKeys.length ? '\n' + JSON.stringify(meta, null, 2) : ''
      return `${timestamp} [${level}]: ${message}${metaString}`
    })
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

  const aiClient = mockInsights.getClient()

  // Pipe Winston logs to Application Insights
  logger.on('data', info => {
    const properties = buildProperties(info)
    if (info.level === 'error') {
      if (info.stack) {
        aiClient.trackException({ exception: new Error(info.message), properties })
      } else {
        aiClient.trackTrace({
          message: info.message,
          severity: appInsights.KnownSeverityLevel.Error,
          properties
        })
      }
    } else {
      aiClient.trackTrace({ message: info.message, severity: mapLevel(info.level), properties })
    }
  })

  return logger
}

const levelMap = new Map([
  ['error', appInsights.KnownSeverityLevel.Error],
  ['warn', appInsights.KnownSeverityLevel.Warning],
  ['info', appInsights.KnownSeverityLevel.Information],
  ['verbose', appInsights.KnownSeverityLevel.Verbose],
  ['debug', appInsights.KnownSeverityLevel.Verbose],
  ['silly', appInsights.KnownSeverityLevel.Verbose]
])

/**
 * Maps Winston log levels to Application Insights severity levels
 * @param {string} level - The Winston log level
 * @returns {string} - The corresponding Application Insights severity level
 */
function mapLevel(level) {
  return levelMap.get(level) ?? appInsights.KnownSeverityLevel.Information
}

module.exports = factory
module.exports.sanitizeHeaders = sanitizeHeaders
module.exports.sanitizeMeta = sanitizeMeta
module.exports.buildProperties = buildProperties
