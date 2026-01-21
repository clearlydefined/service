// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */

/**
 * Middleware that normalizes query string values.
 * Converts string values to their appropriate JavaScript types:
 * - "true" / "false" → boolean
 * - Numeric strings → number
 *
 * @param {Request} request - Express request object
 * @param {Response} _response - Express response object (unused)
 * @param {NextFunction} next - Express next function
 */
module.exports = (request, _response, next) => {
  request.query = _normalize(request.query)
  next()
}

/**
 * Normalizes query object values from strings to appropriate JavaScript types.
 *
 * @param {Record<string, any>} query - The query object to normalize
 * @returns {Record<string, any>} The normalized query object
 */
function _normalize(query) {
  const keys = Object.keys(query)
  for (let key of keys) {
    let value = query[key]
    if (!value) continue
    value = value.toLowerCase()
    if (value === 'true') query[key] = true
    else if (value === 'false') query[key] = false
    else if (!isNaN(value)) query[key] = Number(value)
  }
  return query
}
