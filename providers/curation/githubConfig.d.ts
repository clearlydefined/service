// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { GitHubCurationOptions, ICurationStore, Endpoints } from '.'
import type { GitHubCurationService } from './github'
import type { ICache } from '../caching'

/**
 * Factory function that creates a GitHubCurationService configured from the environment.
 * Reads `CURATION_GITHUB_OWNER`, `CURATION_GITHUB_REPO`, `CURATION_GITHUB_BRANCH`,
 * `CURATION_GITHUB_TOKEN`, and `MULTIVERSION_CURATION_FF` when no options are provided.
 *
 * @param options - Optional override for GitHub configuration
 * @param store - Curation store instance
 * @param endpoints - Website endpoint URLs
 * @param cache - Cache instance
 * @param harvestStore - Harvest store for license matching
 * @returns A configured GitHubCurationService instance
 */
declare function github(
  options: GitHubCurationOptions | null | undefined,
  store: ICurationStore,
  endpoints: Endpoints,
  cache: ICache,
  harvestStore: {
    getAll(coordinates: import('../../lib/entityCoordinates')): Promise<Record<string, Record<string, unknown>>>
  }
): GitHubCurationService

export = github
