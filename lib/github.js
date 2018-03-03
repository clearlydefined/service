// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const GitHubApi = require('github');

module.exports = {
  getClient: function (options) {
    const github = new GitHubApi({
      headers: {
        'user-agent': 'clearlydefined.io'
      }
    });
    github.authenticate({
      type: 'token',
      token: options.token
    });
    return github;
  }
};
