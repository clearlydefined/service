// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')

/**
 * @typedef {import('axios').AxiosRequestConfig} AxiosRequestConfig
 *
 * @typedef {import('axios').AxiosResponse} AxiosResponse
 *
 * @typedef {import('axios').AxiosInstance} AxiosInstance
 *
 * @typedef {import('axios').AxiosStatic} AxiosStatic
 *
 * @typedef {import('axios').ResponseType} ResponseType
 *
 * @typedef {import('./fetch').FetchRequestOptions} FetchRequestOptions
 *
 * @typedef {import('./fetch').FetchResponse} FetchResponse
 *
 * @typedef {import('./fetch').FetchError} FetchError
 *
 * @typedef {import('./fetch').WithDefaultsOptions} WithDefaultsOptions
 *
 * @typedef {import('./fetch').FetchFunction} FetchFunction
 */

/**
 * Default headers used for all HTTP requests made by the fetch utilities. These headers identify the ClearlyDefined
 * crawler to external services.
 *
 * @type {Readonly<{ [key: string]: string }>}
 */
const defaultHeaders = Object.freeze({ 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' })

// Set default headers for all axios requests
Object.assign(axios.defaults.headers.common, defaultHeaders)

/**
 * Builds axios request configuration options from a fetch request.
 *
 * @param {FetchRequestOptions} request - The request configuration
 * @returns {AxiosRequestConfig} The axios request configuration
 */
function buildRequestOptions(request) {
  /** @type {ResponseType} */
  let responseType = 'text'
  if (request.json) {
    responseType = 'json'
  } else if (request.encoding === null) {
    responseType = 'stream'
  }

  const validateOptions = {}
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
 *
 * @param {FetchRequestOptions} request - The request configuration options
 * @param {AxiosStatic | AxiosInstance} [axiosInstance=axios] - Optional axios instance to use for the request. Default
 *   is `axios`
 * @returns {Promise<any | FetchResponse>} Promise that resolves to the response data or full response object
 * @throws {FetchError} When the request fails or returns an error status code
 */
async function callFetch(request, axiosInstance = axios) {
  try {
    const options = buildRequestOptions(request)
    const response = await axiosInstance(options)
    if (!request.resolveWithFullResponse) return response.data
    // @ts-ignore - Adding custom properties to response object
    response.statusCode = response.status
    // @ts-ignore - Adding custom properties to response object
    response.statusMessage = response.statusText
    return response
  } catch (error) {
    // @ts-ignore - Adding statusCode property to error
    error.statusCode = error.response?.status
    throw error
  }
}

/**
 * Creates a new fetch function with default options applied.
 *
 * @param {WithDefaultsOptions} opts - Default options to apply to all requests made with the returned function
 * @returns {FetchFunction} A function that makes HTTP requests with the default options applied
 */
function withDefaults(opts) {
  const axiosInstance = axios.create(opts)
  return request => callFetch(request, axiosInstance)
}

module.exports = { callFetch, withDefaults, defaultHeaders }
