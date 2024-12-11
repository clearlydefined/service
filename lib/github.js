// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const GitHubApi = require('@octokit/rest')
const { defaultHeaders } = require('./fetch')

module.exports = {
  getClient: function (options) {
    const github = new GitHubApi({ headers: defaultHeaders })
    github.authenticate({ type: 'token', token: options.token })
    return github
  }
}
