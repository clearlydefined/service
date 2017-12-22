// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('painless-config');

module.exports = {
  summary: {
    provider: config.get('SUMMARY_PROVIDER') || ''
  },
  curation: {
    store: {
      provider: config.get('CURATION_PROVIDER') || 'github',
      github: {
        owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
        repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
        branch: config.get('CURATION_GITHUB_BRANCH') || process.env.NODE_ENV,
        token: config.get('CURATION_GITHUB_TOKEN')
      }
    }
  },
  harvest: {
    harvester: {
      provider: config.get('HARVESTER_PROVIDER') || 'vstsOrt',
      vstsOrt: {
        authToken: config.get('HARVESTER_VSTSORT_AUTH_TOKEN'),
        collectionUrl: config.get('HARVESTER_VSTSORT_BUILD_COLLECTION_URL') || 'https://clearlydefined.visualstudio.com',
        projectName: config.get('HARVESTER_VSTSORT_BUILD_PROJECT_NAME') || 'ClearlyDefined',
        buildDefinitionName: config.get('HARVESTER_VSTSORT_BUILD_NAME') || 'oss-review-toolkit',
        buildVariableName: config.get('HARVESTER_VSTSORT_SPEC_VAR') || 'ortSpec'
      }
    },
    store: {
      provider: config.get('HARVEST_STORE_PROVIDER') || 'azblob',
      azblob: {
        connectionString: config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
        containerName: config.get('HARVEST_AZBLOB_CONTAINER_NAME') || `harvest-${process.env.NODE_ENV}`
      }
    }
  },
  aggregator: {
    precedence: [['scancode', 'clearlydescribed']]
  },
  auth: {
    apiToken: config.get('API_TOKEN'),
    password: config.get('AUTH_SITE_PASSWORD')
  }
};
