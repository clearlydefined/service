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
import upgradeAzureQueueConfig from '../providers/upgrade/azureQueueConfig.ts'
import upgradeMemoryQueueConfig from '../providers/upgrade/memoryQueueConfig.ts'
import * as recomputeHandler from '../providers/upgrade/recomputeHandler.ts'
import type { ICache } from './caching/index.js'
import listBasedFilterConfig from './harvest/throttling/listBasedFilterConfig.ts'
import type { Logger } from './logging/index.js'

/** Factory function that creates a provider instance */
export type ProviderFactory<T = any> = (options?: any) => T

/** Provider configuration for logging */
export interface LoggingProviders {
  winston: ProviderFactory<Logger>
}

/** Provider configuration for definition stores */
export interface DefinitionProviders {
  azure: ProviderFactory
  file: ProviderFactory
  mongo: ProviderFactory
  mongoTrimmed: ProviderFactory
  dispatch: ProviderFactory
}

/** Provider configuration for attachment stores */
export interface AttachmentProviders {
  azure: ProviderFactory
  file: ProviderFactory
}

/** Provider configuration for search providers */
export interface SearchProviders {
  azure: ProviderFactory
  memory: ProviderFactory
}

/** Provider configuration for caching providers */
export interface CachingProviders {
  redis: ProviderFactory<ICache>
  memory: ProviderFactory<ICache>
}

/** Provider configuration for authentication */
export interface AuthProviders {
  github: ProviderFactory
}

/** Paired queue factories used by recompute handlers */
export interface RecomputeQueueFactories<T = any> {
  upgrade: ProviderFactory<T>
  compute: ProviderFactory<T>
}

/** Provider configuration for upgrade queue */
export interface UpgradeQueueProviders {
  azure: RecomputeQueueFactories
  memory: RecomputeQueueFactories
}

/** Provider configuration for upgrade service */
export interface UpgradeServiceProviders {
  onDemand: ProviderFactory
  /** @deprecated TODO: remove in favor of onDemand */
  versionCheck: ProviderFactory
  delayed: ProviderFactory
  /** @deprecated TODO: remove in favor of delayed */
  upgradeQueue: ProviderFactory
}

/** Provider configuration for upgrade */
export interface UpgradeProviders {
  queue: UpgradeQueueProviders
  service: UpgradeServiceProviders
}

/** Provider configuration for curation queue */
export interface CurationQueueProviders {
  azure: ProviderFactory
  memory: ProviderFactory
}

/** Provider configuration for curation service */
export interface CurationServiceProviders {
  github: ProviderFactory
}

/** Provider configuration for curation store */
export interface CurationStoreProviders {
  memory: ProviderFactory
  mongo: ProviderFactory
}

/** Provider configuration for curation */
export interface CurationProviders {
  queue: CurationQueueProviders
  service: CurationServiceProviders
  store: CurationStoreProviders
}

/** Provider configuration for harvest queue */
export interface HarvestQueueProviders {
  azure: ProviderFactory
  memory: ProviderFactory
}

/** Provider configuration for harvest service */
export interface HarvestServiceProviders {
  crawler: ProviderFactory
  crawlerQueue: ProviderFactory
}

/** Provider configuration for harvest store */
export interface HarvestStoreProviders {
  azure: ProviderFactory
  file: ProviderFactory
}

/** Provider configuration for harvest */
export interface HarvestProviders {
  queue: HarvestQueueProviders
  service: HarvestServiceProviders
  store: HarvestStoreProviders
}

/** Central provider registry containing all provider factories */
export interface Providers {
  logging: LoggingProviders
  definition: DefinitionProviders
  attachment: AttachmentProviders
  search: SearchProviders
  caching: CachingProviders
  auth: AuthProviders
  upgrade: UpgradeProviders
  curation: CurationProviders
  harvest: HarvestProviders
}

const providers: Providers = {
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

export default providers
