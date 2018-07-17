// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const GitHubApi = require('@octokit/rest')

module.exports = {
  getClient: function(options) {
    const github = new GitHubApi({
      headers: {
        'user-agent': 'clearlydefined.io'
      }
    })
    github.authenticate({
      type: 'token',
      token: options.token
    })
    return github
  }
}
