// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')

class DispatchDefinitionStore {
  constructor(options) {
    this.stores = options.stores
    this.logger = options.logger || logger()
  }

  initialize() {
    return this._performInParallel(store => store.initialize())
  }

  get(coordinates) {
    return this._performInSequence(store => store.get(coordinates))
  }

  list(coordinates) {
    return this._performInSequence(store => store.list(coordinates))
  }

  store(definition) {
    return this._performInParallel(store => store.store(definition))
  }

  delete(coordinates) {
    return this._performInParallel(store => store.delete(coordinates))
  }

  find(query, continuationToken = '') {
    return this._performInSequence(store => store.find(query, continuationToken))
  }

  async _performInSequence(operation, first = true) {
    let result = null
    for (let i = 0; i < this.stores.length; i++) {
      const store = this.stores[i]
      try {
        const opResult = await operation(store)
        result = result || opResult
        if (result && first) return result
      } catch (error) {
        this.logger.error('DispatchDefinitionStore failure', error)
      }
    }
    return result
  }

  async _performInParallel(operation) {
    const opPromises = this.stores.map(store => operation(store))
    const results = await Promise.allSettled(opPromises)
    results
      .filter(result => result.status === 'rejected')
      .forEach(result => this.logger.error('DispatchDefinitionStore failure', result.reason))
    const fulfilled = results.find(result => result.status === 'fulfilled')
    return fulfilled?.value
  }
}

module.exports = options => new DispatchDefinitionStore(options)
