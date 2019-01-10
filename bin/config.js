// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('painless-config')
const { get } = require('lodash')
const providers = require('../providers')

/**
 * Loads the given factory for the indicated namespace. The namespace can be a subcomponent
 * of the providers module (e.g., search or store). The `spec` is the name of a module (e.g.,
 * file, memory, mongo) and an optional object path within that module that leads to the
 * desired factory.
 * @param {*} spec - indicator of the module and factory to load
 * @param {*} namespace - an optional place to look for built in factories
 */
function loadFactory(spec, namespace) {
  const [requirePath, objectPath] = spec.split('|')
  const getPath = (namespace ? namespace + '.' : '') + requirePath
  let target = get(providers, getPath)
  try {
    if (!target) target = require(requirePath)
    return objectPath ? get(target, objectPath) : target
  } catch (e) {
    throw new Error(`could not load provider for ${requirePath}`)
  }
}

module.exports = {
  summary: {},
  logging: {
    logger: loadFactory(config.get('LOGGING_PROVIDER') || 'winston', 'logging')
  },
  curation: {
    service: loadFactory(config.get('CURATION_PROVIDER') || 'github', 'curation.service'),
    store: loadFactory(config.get('CURATION_STORE_PROVIDER') || 'memory', 'curation.store')
  },
  harvest: {
    service: loadFactory(config.get('HARVESTER_PROVIDER') || 'crawler', 'harvest.service'),
    store: loadFactory(config.get('HARVEST_STORE_PROVIDER') || 'file', 'harvest.store')
  },
  aggregator: {
    precedence: [['clearlydefined', 'scancode', 'fossology', 'cdsource']]
  },
  definition: {
    store: loadFactory(config.get('DEFINITION_STORE_PROVIDER') || 'file', 'definition')
  },
  attachment: {
    store: loadFactory(config.get('ATTACHMENT_STORE_PROVIDER') || 'file', 'attachment')
  },
  auth: {
    service: loadFactory(config.get('AUTH_PROVIDER') || 'github', 'auth')
  },
  caching: {
    provider: config.get('CACHING_PROVIDER') || 'memory'
  },
  endpoints: {
    service: config.get('SERVICE_ENDPOINT') || 'http://localhost:4000',
    website: config.get('WEBSITE_ENDPOINT') || 'http://localhost:3000'
  },
  limits: {
    windowSeconds: parseInt(config.get('RATE_LIMIT_WINDOW')) || 1,
    max: parseInt(config.get('RATE_LIMIT_MAX')) || 0
  },
  webhook: {
    githubSecret: config.get('WEBHOOK_GITHUB_SECRET'),
    crawlerSecret: config.get('WEBHOOK_CRAWLER_SECRET') || 'secret'
  },
  search: {
    service: loadFactory(config.get('SEARCH_PROVIDER') || 'memory', 'search')
  }
}
