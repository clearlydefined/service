// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const logger = require('../logging/logger')

class DispatchDefinitionStore {
  constructor(options) {
    this.stores = options.stores
    this.logger = logger()
  }

  initialize() {
    return this._perform(store => store.initialize())
  }

  get(coordinates) {
    return this._perform(store => store.get(coordinates), true)
  }

  list(coordinates) {
    return this._perform(store => store.list(coordinates), true)
  }

  store(definition) {
    return this._perform(store => store.store(definition))
  }

  delete(coordinates) {
    return this._perform(store => store.delete(coordinates))
  }

  find(query, continuationToken = '') {
    return this._perform(store => store.find(query, continuationToken), true)
  }

  async _perform(operation, first = false) {
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
}

module.exports = options => new DispatchDefinitionStore(options)
