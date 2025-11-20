// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { Gitlab } = require('@gitbeaker/node')
const { defaultHeaders } = require('./fetch')

/**
 * @typedef {import('./gitlab').GitlabClientOptions} GitlabClientOptions
 *
 * @typedef {import('./gitlab').GitlabModule} GitlabModule
 *
 * @typedef {import('@gitbeaker/node').Gitlab} GitlabClient
 */

/**
 * GitLab client module providing utilities for interacting with GitLab API. This module creates configured GitLab
 * client instances with default headers for use throughout the ClearlyDefined service.
 *
 * @type {GitlabModule}
 */
module.exports = {
  /**
   * Creates and configures a GitLab client instance with standard headers and authentication token.
   *
   * @param {GitlabClientOptions} [options] - Configuration options for the GitLab client
   * @returns {GitlabClient} A configured GitLab client instance
   * @see {@link https://github.com/jdalrymple/gitbeaker GitBeaker Documentation}
   */
  getClient: function (options) {
    const gitlab = new Gitlab({
      headers: defaultHeaders,
      token: options?.token
    })
    return gitlab
  }
}
