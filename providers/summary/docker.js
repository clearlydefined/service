// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const { setIfValue } = require('../../lib/utils')
const EntitySpec = require('../../lib/entityCoordinates')

class DockerSummarizer {
  constructor(options) {
    this.options = options
  }

  summarize(coordinates, harvested) {
    const result = {}
    this._summarizeEmbeddedInfo(result, harvested)
    return result
  }

  _summarizeEmbeddedInfo(result, harvested) {
    const embeddedPackages = get(harvested, 'embedded')
    if (!embeddedPackages || !embeddedPackages.length) return
    const embedded = embeddedPackages.map(entry => {
      const coordinates = EntitySpec.fromObject(entry).toString()
      return { coordinates }
    })
    setIfValue(result, 'described.embedded', embedded)
  }
}

module.exports = options => new DockerSummarizer(options)
