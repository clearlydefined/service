// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { AxiosInstance, AxiosResponse } from 'axios'

/** Default headers used for HTTP requests. */
export declare const defaultHeaders: Readonly<{ 'User-Agent': string }>

/** Request options for HTTP calls. */
export interface FetchRequestOptions {
  /** The HTTP method to use. */
  method?: string
  /** The URL to request (alternative to `uri`). */
  url?: string
  /** The URI to request (alternative to `url`). */
  uri?: string
  /** Whether to parse response as JSON. */
  json?: boolean
  /** Text encoding for the response. Set to `null` for binary/stream responses. */
  encoding?: string | null
  /** HTTP headers to include in the request. */
  headers?: Record<string, string>
  /** Request body data. */
  body?: any
  /** Whether to include credentials in cross-origin requests. */
  withCredentials?: boolean
  /** Whether to throw an error for HTTP error status codes. Defaults to `true`. */
  simple?: boolean
  /** Whether to return the full response object instead of just the data. */
  resolveWithFullResponse?: boolean
}

/** Extended response object returned when `resolveWithFullResponse` is true. */
export interface FetchResponse<T = any> extends AxiosResponse<T> {
  /** HTTP status code (alias for `status`). */
  statusCode: number
  /** HTTP status message (alias for `statusText`). */
  statusMessage: string
  /** Response configuration used for the request. */
  config: any
}

/** HTTP error with status code information. */
export interface FetchError extends Error {
  /** HTTP status code of the error response. */
  statusCode?: number
  /** The original response object if available. */
  response?: AxiosResponse
}

/** Options for creating a fetch instance with default settings. */
export interface WithDefaultsOptions {
  /** Default headers to include in all requests. */
  headers?: Record<string, string>
  /** Other axios configuration options. */
  [key: string]: any
}

/** Function signature for making HTTP requests with default options applied. */
export type FetchFunction = (request: FetchRequestOptions) => Promise<any>

/**
 * Makes an HTTP request using axios with the specified options.
 *
 * @param request - The request configuration options
 * @param axiosInstance - Optional axios instance to use for the request
 * @returns Promise that resolves to the response data or full response object
 * @throws {FetchError} When the request fails or returns an error status code
 */
export declare function callFetch<T = any>(
  request: FetchRequestOptions,
  axiosInstance?: AxiosInstance
): Promise<T | FetchResponse<T>>

/**
 * Creates a new fetch function with default options applied.
 *
 * @param opts - Default options to apply to all requests made with the returned function
 * @returns A function that makes HTTP requests with the default options applied
 */
export declare function withDefaults(opts: WithDefaultsOptions): FetchFunction
