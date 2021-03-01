// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const githubService = require('./github')

function github(options, store, endpoints, cache, harvestStore) {
  const realOptions = options || {
    owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
    repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
    branch: config.get('CURATION_GITHUB_BRANCH') || 'master',
    token: config.get('CURATION_GITHUB_TOKEN')
  }
  return githubService(realOptions, store, endpoints, null, cache, harvestStore)
}

module.exports = github
