// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')

module.exports = {
  summary: {},
  curation: {
    store: {
      provider: config.get('CURATION_PROVIDER') || 'github',
      github: {
        owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
        repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
        branch: config.get('CURATION_GITHUB_BRANCH') || process.env.NODE_ENV,
        token: config.get('CURATION_GITHUB_TOKEN'),
        tempLocation: config.get('CURATION_TEMP_LOCATION') || (process.platform === 'win32' ? 'c:/temp' : '/tmp'),
        curationFreshness: config.get('CURATION_FRESHNESS') || 600000
      }
    }
  },
  harvest: {
    harvester: {
      provider: config.get('HARVESTER_PROVIDER') || 'crawler',
      crawler: {
        authToken: config.get('CRAWLER_SERVICE_AUTH_TOKEN'),
        url: config.get('CRAWLER_SERVICE_URL')
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
    precedence: [['scancode', 'clearlydefined', 'cdsource']]
  },
  definition: {
    store: {
      provider: config.get('COMPONENT_STORE_PROVIDER') || config.get('HARVEST_STORE_PROVIDER') || 'file',
      azblob: {
        connectionString:
          config.get('COMPONENT_AZBLOB_CONNECTION_STRING') || config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
        containerName:
          config.get('COMPONENT_AZBLOB_CONTAINER_NAME') ||
          config.get('HARVEST_AZBLOB_CONTAINER_NAME') + '-definition' ||
          `definition-${process.env.NODE_ENV}`
      },
      file: {
        location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
      }
    }
  },
  auth: {
    github: {
      clientId: config.get('AUTH_GITHUB_CLIENT_ID'),
      clientSecret: config.get('AUTH_GITHUB_CLIENT_SECRET'),
      org: config.get('AUTH_GITHUB_ORG') || 'clearlydefined',
      timeouts: {
        team: 10 * 60 // 10 mins
      },
      permissions: {
        harvest: [config.get('AUTH_HARVEST_TEAM')].filter(e => e),
        curate: [config.get('AUTH_CURATION_TEAM')].filter(e => e)
      }
    }
  },
  caching: {
    provider: config.get('CACHING_PROVIDER') || 'memory'
  },
  endpoints: {
    service: config.get('SERVICE_ENDPOINT') || 'http://localhost:4000',
    website: config.get('WEBSITE_ENDPOINT') || 'http://localhost:3000'
  },
  limits: {
    windowSeconds: parseInt(config.get('RATE_LIMIT_WINDOW')) || 1,
    max: parseInt(config.get('RATE_LIMIT_MAX')) || 0
  },
  webhook: {
    githubSecret: config.get('WEBHOOK_GITHUB_SECRET'),
    crawlerSecret: config.get('CRAWLER_WEBHOOK_SECRET') || 'secret'
  },
  search: {
    provider: 'azureSearch',
    azureSearch: {
      service: config.get('SEARCH_AZURE_SERVICE'),
      apiKey: config.get('SEARCH_AZURE_API_KEY')
    }
  }
}
