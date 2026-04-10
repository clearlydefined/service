// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, ResponseType } from 'axios'
import axios from 'axios'

/** Request options for HTTP calls. */
export interface FetchRequestOptions {
  method?: string
  url?: string
  uri?: string
  json?: boolean
  encoding?: string | null
  headers?: Record<string, string>
  body?: unknown
  withCredentials?: boolean
  simple?: boolean
  resolveWithFullResponse?: boolean
}

/** Extended response object returned when `resolveWithFullResponse` is true. */
export interface FetchResponse<T = any> extends AxiosResponse<T> {
  statusCode: number
  statusMessage: string
}

/** HTTP error with status code information. */
export interface FetchError extends Error {
  statusCode?: number
  response?: AxiosResponse
}

/** Options for creating a fetch instance with default settings. */
export interface WithDefaultsOptions {
  headers?: Record<string, string>
  [key: string]: any
}

/** Function signature for making HTTP requests with default options applied. */
export type FetchFunction = (request: FetchRequestOptions) => Promise<any>

/**
 * Default headers used for all HTTP requests made by the fetch utilities.
 */
const defaultHeaders: Readonly<Record<string, string>> = Object.freeze({
  'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)'
})

// Set default headers for all axios requests
Object.assign(axios.defaults.headers.common, defaultHeaders)

/**
 * Builds axios request configuration options from a fetch request.
 */
function buildRequestOptions(request: FetchRequestOptions): AxiosRequestConfig {
  let responseType: ResponseType = 'text'
  if (request.json) {
    responseType = 'json'
  } else if (request.encoding === null) {
    responseType = 'stream'
  }

  const validateOptions: Record<string, any> = {}
  if (request.simple === false) {
    validateOptions.validateStatus = () => true
  }

  return {
    method: request.method,
    url: request.url || request.uri,
    responseType,
    headers: request.headers,
    data: request.body,
    withCredentials: request.withCredentials,
    ...validateOptions
  }
}

/**
 * Makes an HTTP request using axios with the specified options.
 */
async function callFetch<T = any>(
  request: FetchRequestOptions,
  axiosInstance: typeof axios | AxiosInstance = axios
): Promise<T | FetchResponse<T>> {
  try {
    const options = buildRequestOptions(request)
    const response = await axiosInstance(options)
    if (!request.resolveWithFullResponse) {
      return response.data
    }
    const fullResponse = response as unknown as FetchResponse<T>
    fullResponse.statusCode = response.status
    fullResponse.statusMessage = response.statusText
    return fullResponse
  } catch (error: any) {
    error.statusCode = error.response?.status
    throw error
  }
}

/**
 * Creates a new fetch function with default options applied.
 */
function withDefaults(opts: WithDefaultsOptions): FetchFunction {
  const axiosInstance = axios.create(opts)
  return request => callFetch(request, axiosInstance)
}

export { callFetch, defaultHeaders, withDefaults }
