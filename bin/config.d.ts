// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

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
} from '../business/definitionService.js'
import type { AttachmentStore } from '../business/noticeService.js'
import type { StatsSearchService } from '../business/statsService.js'
import type { PermissionsConfig } from '../middleware/permissions.ts'
import type { ICache } from '../providers/caching/index.js'
import type { CurationHarvestStore, ICurationStore } from '../providers/curation/index.js'
import type { CurationProcessService, CurationWebhookPayload } from '../providers/curation/process.ts'
import type { Logger } from '../providers/logging/index.js'
import type { IQueue } from '../providers/queueing/index.js'
import type { RecomputeQueueFactories } from '../providers.js'

/** Provider instance that supports async initialization */
interface Initializable {
  initialize(): Promise<void> | void
}

/** Service endpoint URLs */
interface ConfigEndpoints {
  service: string
  website: string
}

/** Auth route module returned by auth.service.route() */
interface AuthRouteModule {
  router: Router
  usePassport(): boolean
  getStrategy(): GitHubStrategy
}

/** Auth service module with permission, route, and middleware setup */
interface AuthServiceModule {
  permissionsSetup(options?: PermissionsConfig): void
  route(options: unknown, endpoints: ConfigEndpoints): AuthRouteModule
  middleware(options?: unknown, cache?: ICache): RequestHandler
}

/** Application configuration built from environment variables and provider factories */
interface AppConfig {
  summary: import('../business/summarizer').SummaryServiceOptions
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
  upgrade: {
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

export type { AppConfig, AuthRouteModule, AuthServiceModule, ConfigEndpoints, Initializable }

declare const config: AppConfig

export default config
