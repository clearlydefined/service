// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('painless-config');

module.exports = {
  summary: {
  },
  curation: {
    store: {
      provider: config.get('CURATION_PROVIDER') || 'github',
      github: {
        owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
        repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
        branch: config.get('CURATION_GITHUB_BRANCH') || process.env.NODE_ENV,
        token: config.get('CURATION_GITHUB_TOKEN'),
        webhookSecret: config.get('CURATION_GITHUB_WEBHOOK_SECRET'),
        tempLocation: config.get('CURATION_TEMP_LOCATION') || (process.platform === 'win32' ? 'c:/temp' : '/tmp'),
        curationFreshness: config.get('CURATION_FRESHNESS') || 600000
      }
    }
  },
  harvest: {
    harvester: {
      provider: config.get('HARVESTER_PROVIDER') || 'crawler',
      crawler: {
        authToken: config.get('CRAWLER_AUTH_TOKEN'),
        url: config.get('CRAWLER_API_URL')
      },
      vsts: {
        authToken: config.get('HARVESTER_VSTS_AUTH_TOKEN'),
        collectionUrl: config.get('HARVESTER_VSTS_BUILD_COLLECTION_URL') || 'https://clearlydefined.visualstudio.com',
        projectName: config.get('HARVESTER_VSTS_BUILD_PROJECT_NAME') || 'ClearlyDefined',
        buildDefinitionName: config.get('HARVESTER_VSTS_BUILD_NAME') || 'clearlydefined-ort',
        buildVariableName: config.get('HARVESTER_VSTS_SPEC_VAR') || 'ortSpec'
      }
    },
    store: {
      provider: config.get('HARVEST_STORE_PROVIDER') || 'file',
      azblob: {
        connectionString: config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
        containerName: config.get('HARVEST_AZBLOB_CONTAINER_NAME') || `harvest-${process.env.NODE_ENV}`
      },
      file: {
        location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
      }
    }
  },
  aggregator: {
    precedence: [['scancode', 'clearlydescribed']]
  },
  component: {
    store: {
      provider: config.get('COMPONENT_STORE_PROVIDER') || config.get('HARVEST_STORE_PROVIDER') || 'file',
      azblob: {
        connectionString: config.get('COMPONENT_AZBLOB_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
        containerName: config.get('COMPONENT_AZBLOB_CONTAINER_NAME') || config.get('HARVEST_AZBLOB_CONTAINER_NAME') + '-component' || `component-${process.env.NODE_ENV}`
      },
      file: {
        location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
      }
    }
  },
  auth: {
    apiToken: config.get('API_TOKEN'),
    password: config.get('AUTH_SITE_PASSWORD'),
    github: {
      clientId: config.get('AUTH_GITHUB_CLIENT_ID'),
      clientSecret: config.get('AUTH_GITHUB_CLIENT_SECRET'),
      org: config.get('AUTH_GITHUB_ORG') || 'clearlydefined'
    }
  },
  caching: {
    provider: config.get('CACHING_PROVIDER') || 'memory'
  },
  endpoints: {
    service: config.get('SERVICE_ENDPOINT') || 'http://localhost:4000',
    website: config.get('WEBSITE_ENDPOINT') || 'http://localhost:3000'
  }
};