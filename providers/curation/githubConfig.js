// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const githubService = require('./github')

function github(options, endpoints) {
  const realOptions = options || {
    owner: config.get('CURATION_GITHUB_OWNER') || 'clearlydefined',
    repo: config.get('CURATION_GITHUB_REPO') || 'curated-data',
    branch: config.get('CURATION_GITHUB_BRANCH') || 'master',
    token: config.get('CURATION_GITHUB_TOKEN'),
    tempLocation: config.get('CURATION_TEMP_LOCATION') || (process.platform === 'win32' ? 'c:/temp' : '/tmp'),
    curationFreshness: config.get('CURATION_FRESHNESS') || 600000
  }
  return githubService(realOptions, endpoints)
}

module.exports = github
