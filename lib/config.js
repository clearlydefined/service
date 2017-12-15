// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('painless-config');

module.exports = {
  curation: {
    store: {
      github: {
        owner: config.get('CURATION_GITHUB_OWNER'),
        repo: config.get('CURATION_GITHUB_REPO'),
        branch: config.get('CURATION_GITHUB_BRANCH'),
        token: config.get('CURATION_GITHUB_TOKEN')
      }
    }
  },
  auth: {
    apiToken: config.get('API_TOKEN')
  }
};
