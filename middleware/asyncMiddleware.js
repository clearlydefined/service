// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('./asyncMiddleware').AsyncMiddlewareFunction} AsyncMiddlewareFunction */

/**
 * Wraps an async middleware function to properly catch and forward errors.
 * This allows using async/await in Express middleware while ensuring errors
 * are properly passed to Express error handling.
 *
 * @param {AsyncMiddlewareFunction} func - The async middleware function to wrap
 * @returns {import('express').RequestHandler} A standard Express middleware that handles async errors
 */
module.exports = func => async (request, response, next) => {
  try {
    await func(request, response, next)
  } catch (error) {
    next(error)
  }
}
