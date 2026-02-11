// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Async function that can be wrapped by asyncMiddleware.
 * Can be a standard middleware function or a route handler.
 * Returns Promise<any> to allow route handlers that return response.send() etc.
 */
export type AsyncMiddlewareFunction = (request: Request, response: Response, next: NextFunction) => Promise<any>

/**
 * Wraps an async middleware function to properly catch and forward errors.
 * This allows using async/await in Express middleware while ensuring errors
 * are properly passed to Express error handling.
 *
 * @param func - The async middleware function to wrap
 * @returns A standard Express middleware that handles async errors
 *
 * @example
 * ```js
 * const asyncMiddleware = require('./asyncMiddleware')
 *
 * app.get('/route', asyncMiddleware(async (req, res, next) => {
 *   const data = await fetchData()
 *   res.json(data)
 * }))
 * ```
 */
declare function asyncMiddleware(func: AsyncMiddlewareFunction): RequestHandler

export default asyncMiddleware
export = asyncMiddleware
