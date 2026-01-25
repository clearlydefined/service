// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'

/**
 * Middleware that normalizes query string values.
 *
 * Converts string values to their appropriate JavaScript types:
 * - "true" / "false" → boolean
 * - Numeric strings → number
 *
 * @example
 * ```js
 * const querystring = require('./querystring')
 *
 * // Before: req.query = { enabled: "true", count: "5" }
 * app.use(querystring)
 * // After: req.query = { enabled: true, count: 5 }
 * ```
 */
declare const querystringMiddleware: RequestHandler

export default querystringMiddleware
export = querystringMiddleware
