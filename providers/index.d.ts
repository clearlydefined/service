// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { ICache } from './caching'
import type { Logger } from './logging'

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

/** Provider configuration for upgrade queue */
export interface UpgradeQueueProviders {
  azure: ProviderFactory
  memory: ProviderFactory
}

/** Provider configuration for upgrade service */
export interface UpgradeServiceProviders {
  versionCheck: ProviderFactory
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

declare const providers: Providers

export = providers
