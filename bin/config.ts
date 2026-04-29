// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import config from 'painless-config'

const { get } = lodash

import type { RequestHandler, Router } from 'express'
import type { Strategy as GitHubStrategy } from 'passport-github'
import type {
  CurationService,
  DefinitionService,
  DefinitionStore,
  HarvestService,
  HarvestStore,
  RecomputeHandler,
  SearchService
} from '../business/definitionService.ts'
import type { AttachmentStore } from '../business/noticeService.ts'
import type { StatsSearchService } from '../business/statsService.ts'
import type { SummaryServiceOptions } from '../business/summarizer.ts'
import type { PermissionsConfig } from '../middleware/permissions.ts'
import type { ICache } from '../providers/caching/index.js'
import type { CurationHarvestStore, ICurationStore } from '../providers/curation/index.js'
import type { CurationProcessService, CurationWebhookPayload } from '../providers/curation/process.ts'
import type { RecomputeQueueFactories } from '../providers/index.ts'
import providers from '../providers/index.ts'
import type { Logger } from '../providers/logging/index.js'
import type { IQueue } from '../providers/queueing/index.js'

/** Provider instance that supports async initialization */
export interface Initializable {
  initialize(): Promise<void> | void
}

/** Service endpoint URLs */
export interface ConfigEndpoints {
  service: string
  website: string
}

/** Auth route module returned by auth.service.route() */
export interface AuthRouteModule {
  router: Router
  usePassport(): boolean
  getStrategy(): GitHubStrategy
}

/** Auth service module with permission, route, and middleware setup */
export interface AuthServiceModule {
  permissionsSetup(options?: PermissionsConfig): void
  route(options: unknown, endpoints: ConfigEndpoints): AuthRouteModule
  middleware(options?: unknown, cache?: ICache): RequestHandler
}

/** Application configuration built from environment variables and provider factories */
export interface AppConfig {
  summary: SummaryServiceOptions
  logging: {
    logger: () => Logger
  }
  auth: {
    service: AuthServiceModule
  }
  curation: {
    queue: () => IQueue<CurationWebhookPayload> & Initializable
    service: (
      options: unknown,
      store: ICurationStore,
      endpoints: ConfigEndpoints,
      cache: ICache,
      harvestStore: CurationHarvestStore
    ) => CurationService & CurationProcessService & { definitionService?: DefinitionService }
    store: () => ICurationStore & Initializable
  }
  harvest: {
    queue: () => IQueue & Initializable
    service: (options?: { cachingService: ICache }) => HarvestService
    store: () => HarvestStore & CurationHarvestStore & Initializable
    throttler: () => unknown
  }
  aggregator: {
    precedence: string[][]
  }
  definition: {
    store: () => DefinitionStore & Initializable
  }
  recompute: {
    queue: RecomputeQueueFactories<IQueue & Initializable>
    service: (options: { queue: RecomputeQueueFactories<IQueue & Initializable> }) => RecomputeHandler & Initializable
  }
  attachment: {
    store: () => AttachmentStore & Initializable
  }
  caching: {
    service: () => ICache & Initializable
  }
  endpoints: ConfigEndpoints
  limits: {
    windowSeconds: number
    max: number
    batchWindowSeconds: number
    batchMax: number
  }
  webhook: {
    githubSecret: string
    crawlerSecret: string
  }
  search: {
    service: () => SearchService & StatsSearchService & Initializable
  }
  insights: {
    serviceId: string
    serviceKey: string
    crawlerId: string
    crawlerKey: string
  }
  appVersion: string
  buildsha: string
  heapstats: {
    logHeapstats: string
    logInverval: string
  }
}

/**
 * Loads the given factory for the indicated namespace. The namespace can be a subcomponent
 * of the providers module (e.g., search or store). The `spec` is the name of a module (e.g.,
 * file, memory, mongo) and an optional object path within that module that leads to the
 * desired factory.
 * Dispatch to multiple with + (e.g. spec=dispatch+mongo+azblob)
 */
function loadFactory(spec: string, namespace?: string) {
  const names = spec.split('+')
  const factory = loadOne(names[0], namespace)
  const factories = names.slice(1).map(name => loadOne(name, namespace))
  if (factories.length) {
    return () => factory({ factories })
  }
  return factory
}

function loadOne(spec: string, namespace?: string) {
  const [requirePath, objectPath] = spec.split('|')
  const getPath = (namespace ? `${namespace}.` : '') + requirePath
  const target = get(providers, getPath)
  if (!target) {
    throw new Error(`unknown provider ${requirePath} in namespace ${namespace || '(root)'}`)
  }
  return objectPath ? get(target, objectPath) : target
}

export default {
  summary: {},
  logging: {
    logger: loadFactory(config.get('LOGGING_PROVIDER') || 'winston', 'logging')
  },
  curation: {
    queue: loadFactory(config.get('CURATION_QUEUE_PROVIDER') || 'memory', 'curation.queue'),
    service: loadFactory(config.get('CURATION_PROVIDER') || 'github', 'curation.service'),
    store: loadFactory(config.get('CURATION_STORE_PROVIDER') || 'memory', 'curation.store')
  },
  harvest: {
    queue: loadFactory(config.get('HARVEST_QUEUE_PROVIDER') || 'memory', 'harvest.queue'),
    service: loadFactory(config.get('HARVESTER_PROVIDER') || 'crawler', 'harvest.service'),
    store: loadFactory(config.get('HARVEST_STORE_PROVIDER') || 'file', 'harvest.store'),
    throttler: loadFactory(config.get('HARVEST_THROTTLER_PROVIDER') || 'filter', 'harvest.throttler')
  },
  aggregator: {
    precedence: [['clearlydefined', 'reuse', 'licensee', 'scancode', 'fossology', 'cdsource']]
  },
  definition: {
    store: loadFactory(config.get('DEFINITION_STORE_PROVIDER') || 'file', 'definition')
  },
  recompute: {
    queue: loadFactory(
      config.get('DEFINITION_RECOMPUTE_QUEUE_PROVIDER') || config.get('DEFINITION_UPGRADE_QUEUE_PROVIDER') || 'memory',
      'recompute.queue'
    ),
    service: loadFactory(
      config.get('DEFINITION_RECOMPUTE_PROVIDER') || config.get('DEFINITION_UPGRADE_PROVIDER') || 'onDemand',
      'recompute.service'
    )
  },
  attachment: {
    store: loadFactory(config.get('ATTACHMENT_STORE_PROVIDER') || 'file', 'attachment')
  },
  auth: {
    service: loadFactory(config.get('AUTH_PROVIDER') || 'github', 'auth')
  },
  caching: {
    service: loadFactory(config.get('CACHING_PROVIDER') || 'memory', 'caching')
  },
  endpoints: {
    service: config.get('SERVICE_ENDPOINT') || 'http://localhost:4000',
    website: config.get('WEBSITE_ENDPOINT') || 'http://localhost:3000'
  },
  limits: {
    windowSeconds: Number.parseInt(config.get('RATE_LIMIT_WINDOW'), 10) || 1,
    max: Number.parseInt(config.get('RATE_LIMIT_MAX'), 10) || 0,
    batchWindowSeconds: Number.parseInt(config.get('BATCH_RATE_LIMIT_WINDOW'), 10) || 1,
    batchMax: Number.parseInt(config.get('BATCH_RATE_LIMIT_MAX'), 10) || 0
  },
  webhook: {
    githubSecret:
      config.get('WEBHOOK_GITHUB_SECRET') ||
      (() => {
        throw new Error('WEBHOOK_GITHUB_SECRET is required')
      })(),
    crawlerSecret:
      config.get('WEBHOOK_CRAWLER_SECRET') ||
      (() => {
        throw new Error('WEBHOOK_CRAWLER_SECRET is required')
      })()
  },
  search: {
    service: loadFactory(config.get('SEARCH_PROVIDER') || 'memory', 'search')
  },
  insights: {
    serviceId: config.get('APPINSIGHTS_SERVICE_APPLICATIONID'),
    serviceKey: config.get('APPINSIGHTS_SERVICE_APIKEY'),
    crawlerId: config.get('APPINSIGHTS_CRAWLER_APPLICATIONID'),
    crawlerKey: config.get('APPINSIGHTS_CRAWLER_APIKEY')
  },
  appVersion: config.get('APP_VERSION'),
  buildsha: config.get('BUILD_SHA'),
  heapstats: {
    logHeapstats: config.get('LOG_NODE_HEAPSTATS'),
    logInverval: config.get('LOG_NODE_HEAPSTATS_INTERVAL_MS')
  }
}
