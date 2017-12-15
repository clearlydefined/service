// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('painless-config');

module.exports = {
  curation: {
    store: {
      provider: config.get('CURATION_PROVIDER'), 
      github: {
        owner: config.get('CURATION_GITHUB_OWNER'),
        repo: config.get('CURATION_GITHUB_REPO'),
        branch: config.get('CURATION_GITHUB_BRANCH'),
        token: config.get('CURATION_GITHUB_TOKEN')
      }
    }
  },
  harvest: {
    store: {
      provider: config.get('HARVEST_PROVIDER'),
      azblob: {
        connectionString: config.get('HARVEST_AZBLOB_CONNECTION_STRING')
      }
    }
  },
  auth: {
    apiToken: config.get('API_TOKEN')
  }
};
