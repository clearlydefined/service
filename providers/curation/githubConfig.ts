// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { ICache } from '../caching/index.js'
import githubService from './github.ts'
import type { CurationDefinitionService, CurationHarvestStore, Endpoints, GitHubCurationOptions, ICurationStore } from './index.js'

function github(
  options: GitHubCurationOptions | null | undefined,
  store: ICurationStore,
  endpoints: Endpoints,
  cache: ICache,
  harvestStore: CurationHarvestStore
) {
  const realOptions: GitHubCurationOptions = options || {
    owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
    repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
    branch: config.get('CURATION_GITHUB_BRANCH') || 'master',
    token: config.get('CURATION_GITHUB_TOKEN')!,
    multiversionCurationFeatureFlag: config.get('MULTIVERSION_CURATION_FF') === 'true'
  }
  return githubService(realOptions, store, endpoints, null as unknown as CurationDefinitionService, cache, harvestStore)
}

export default github
