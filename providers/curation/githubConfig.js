// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const githubService = require('./github')
const githubStore = require('./githubStore')

const owner = config.get('CURATION_GITHUB_OWNER') || 'clearlydefined'
const repo = config.get('CURATION_GITHUB_REPO') || 'curated-data'
const branch = config.get('CURATION_GITHUB_BRANCH') || 'master'
const token = config.get('CURATION_GITHUB_TOKEN')

function service(options, store, endpoints) {
  const realOptions = options || { owner, repo, branch, token }
  return githubService(realOptions, store, endpoints)
}

function store(options) {
  const realOptions = options || {
    owner,
    repo,
    branch,
    token,
    tempLocation: config.get('CURATION_TEMP_LOCATION') || (process.platform === 'win32' ? 'c:/temp' : '/tmp'),
    curationFreshness: config.get('CURATION_FRESHNESS') || 600000
  }
  return githubStore(realOptions)
}

module.exports = { service, store }
