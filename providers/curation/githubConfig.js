// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('.').GitHubCurationOptions} GitHubCurationOptions */
/** @typedef {import('.').ICurationStore} ICurationStore */
/** @typedef {import('.').Endpoints} Endpoints */
/** @typedef {import('.').CurationHarvestStore} CurationHarvestStore */
/** @typedef {import('../caching').ICache} ICache */

const config = require('painless-config')
const githubService = require('./github')

/**
 * @param {GitHubCurationOptions | null | undefined} options
 * @param {ICurationStore} store
 * @param {Endpoints} endpoints
 * @param {ICache} cache
 * @param {CurationHarvestStore} harvestStore
 */
function github(options, store, endpoints, cache, harvestStore) {
  const realOptions = options || {
    owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
    repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
    branch: config.get('CURATION_GITHUB_BRANCH') || 'master',
    token: config.get('CURATION_GITHUB_TOKEN'),
    multiversionCurationFeatureFlag: config.get('MULTIVERSION_CURATION_FF') === 'true'
  }
  return githubService(realOptions, store, endpoints, null, cache, harvestStore)
}

module.exports = github
