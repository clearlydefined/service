// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import githubAuthConfig from '../middleware/githubConfig.ts'
import memoryCaching from '../providers/caching/memory.ts'
import redisConfig from '../providers/caching/redisConfig.ts'
import curationAzureQueueConfig from '../providers/curation/azureQueueConfig.ts'
import curationGithubConfig from '../providers/curation/githubConfig.ts'
import curationMemoryStore from '../providers/curation/memoryStore.ts'
import curationMongoConfig from '../providers/curation/mongoConfig.ts'
import harvestAzureQueueConfig from '../providers/harvest/azureQueueConfig.ts'
import crawlerConfig from '../providers/harvest/crawlerConfig.ts'
import crawlerQueueConfig from '../providers/harvest/crawlerQueueConfig.ts'
import winstonConfig from '../providers/logging/winstonConfig.ts'
import memoryQueue from '../providers/queueing/memoryQueue.ts'
import azureSearchConfig from '../providers/search/azureConfig.ts'
import memorySearch from '../providers/search/memory.ts'
import azblobConfig from '../providers/stores/azblobConfig.ts'
import dispatchConfig from '../providers/stores/dispatchConfig.ts'
import fileConfig from '../providers/stores/fileConfig.ts'
import mongoConfig from '../providers/stores/mongoConfig.ts'
import upgradeAzureQueueConfig from '../providers/upgrade/azureQueueConfig.js'
import upgradeMemoryQueueConfig from '../providers/upgrade/memoryQueueConfig.js'
import * as recomputeHandler from '../providers/upgrade/recomputeHandler.js'
import listBasedFilterConfig from './harvest/throttling/listBasedFilterConfig.ts'

export default {
  logging: {
    winston: winstonConfig
  },
  definition: {
    azure: azblobConfig.definition,
    file: fileConfig.definition,
    mongo: mongoConfig.definitionPaged,
    mongoTrimmed: mongoConfig.definitionTrimmed,
    dispatch: dispatchConfig
  },
  attachment: {
    azure: azblobConfig.attachment,
    file: fileConfig.attachment
  },
  search: {
    azure: azureSearchConfig,
    memory: memorySearch
  },
  caching: {
    redis: redisConfig,
    memory: memoryCaching
  },
  auth: {
    github: githubAuthConfig
  },
  upgrade: {
    queue: {
      azure: upgradeAzureQueueConfig,
      memory: upgradeMemoryQueueConfig
    },
    service: {
      onDemand: recomputeHandler.defaultFactory,
      versionCheck: recomputeHandler.defaultFactory,
      delayed: recomputeHandler.delayedFactory,
      upgradeQueue: recomputeHandler.delayedFactory
    }
  },
  curation: {
    queue: {
      azure: curationAzureQueueConfig,
      memory: memoryQueue
    },
    service: { github: curationGithubConfig },
    store: {
      memory: curationMemoryStore,
      mongo: curationMongoConfig
    }
  },
  harvest: {
    queue: {
      azure: harvestAzureQueueConfig,
      memory: memoryQueue
    },
    service: {
      crawler: crawlerConfig,
      crawlerQueue: crawlerQueueConfig
    },
    store: {
      azure: azblobConfig.harvest,
      file: fileConfig.harvest
    },
    throttler: {
      filter: listBasedFilterConfig
    }
  }
}
