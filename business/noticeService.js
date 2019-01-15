// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const validator = require('../schemas/validator')
const DocBuilder = require('tiny-attribution-generator/lib/docbuilder').default
const TextRenderer = require('tiny-attribution-generator/lib/outputs/text').default
const JsonSource = require('tiny-attribution-generator/lib/inputs/json').default

const logger = require('../providers/logging/logger')

class NoticeService {
  constructor(definitionService) {
    this.definitionService = definitionService
    this.logger = logger()
  }

  async generate(coordinates) {
    const textRenderer = new TextRenderer()
    const docbuilder = new DocBuilder(textRenderer)
    const result = await this.definitionService.getAll(coordinates)
    const source = new JsonSource(
      JSON.stringify({
        packages: Object.keys(result).map(id => {
          const definition = result[id]
          return {
            name: this._getName(definition),
            version: get(definition, 'coordinates.revision'),
            license: get(definition, 'licensed.declared'),
            copyrights: get(definition, 'licensed.facets.core.attribution.parties'),
            website: get(definition, 'described.projectWebsite') || ''
          }
        })
      })
    )
    await docbuilder.read(source)
    return docbuilder.build()
  }

  _getName(definition) {
    if (!definition.coordinates) return null
    return [(definition.coordinates.namespace, definition.coordinates.name)].filter(x => x).join('/')
  }
}

module.exports = definitionService => new NoticeService(definitionService)
