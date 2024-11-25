// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = {
  logging: {
    winston: require('../providers/logging/winstonConfig')
  },
  definition: {
    azure: require('../providers/stores/azblobConfig').definition,
    file: require('../providers/stores/fileConfig').definition,
    mongo: require('../providers/stores/mongoConfig').definitionPaged,
    mongoTrimmed: require('../providers/stores/mongoConfig').definitionTrimmed,
    dispatch: require('../providers/stores/dispatchConfig')
  },
  attachment: {
    azure: require('../providers/stores/azblobConfig').attachment,
    file: require('../providers/stores/fileConfig').attachment
  },
  search: {
    azure: require('../providers/search/azureConfig'),
    memory: require('../providers/search/memory')
  },
  caching: {
    redis: require('../providers/caching/redisConfig'),
    memory: require('../providers/caching/memory')
  },
  auth: {
    github: require('../middleware/githubConfig')
  },
  upgrade: {
    queue: {
      azure: require('../providers/upgrade/azureQueueConfig'),
      memory: require('../providers/queueing/memoryQueue')
    },
    service: {
      versionCheck: require('../providers/upgrade/defVersionCheck').factory,
      upgradeQueue: require('../providers/upgrade/defUpgradeQueueConfig')
    }
  },
  curation: {
    queue: {
      azure: require('../providers/curation/azureQueueConfig'),
      memory: require('../providers/queueing/memoryQueue')
    },
    service: { github: require('../providers/curation/githubConfig') },
    store: {
      memory: require('../providers/curation/memoryStore'),
      mongo: require('../providers/curation/mongoConfig')
    }
  },
  harvest: {
    queue: {
      azure: require('../providers/harvest/azureQueueConfig'),
      memory: require('../providers/queueing/memoryQueue')
    },
    service: {
      crawler: require('../providers/harvest/crawlerConfig'),
      crawlerQueue: require('../providers/harvest/crawlerQueueConfig')
    },
    store: {
      azure: require('../providers/stores/azblobConfig').harvest,
      file: require('../providers/stores/fileConfig').harvest
    }
  }
}
