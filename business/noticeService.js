// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const validator = require('../schemas/validator')
const DocBuilder = require('tiny-attribution-generator/lib/docbuilder').default
const TextRenderer = require('tiny-attribution-generator/lib/outputs/text').default
const TemplateRenderer = require('tiny-attribution-generator/lib/outputs/template').default
const JsonSource = require('tiny-attribution-generator/lib/inputs/json').default

const logger = require('../providers/logging/logger')

class NoticeService {
  constructor(definitionService, attachmentStore) {
    this.definitionService = definitionService
    this.attachmentStore = attachmentStore
    this.logger = logger()
  }

  async generate(coordinates, template = '') {
    const renderer = template ? new TemplateRenderer(template) : new TextRenderer()
    const docbuilder = new DocBuilder(renderer)
    const result = await this.definitionService.getAll(coordinates)
    const source = new JsonSource(
      JSON.stringify({
        packages: await Promise.all(
          Object.keys(result).map(async id => {
            const definition = result[id]
            return {
              name: [definition.coordinates.namespace, definition.coordinates.name].filter(x => x).join('/'),
              version: get(definition, 'coordinates.revision'),
              license: get(definition, 'licensed.declared'),
              copyrights: get(definition, 'licensed.facets.core.attribution.parties'),
              website: get(definition, 'described.projectWebsite') || '',
              text: await this._getPackageText(definition)
            }
          })
        )
      })
    )
    await docbuilder.read(source)
    return docbuilder.build()
  }

  async _getPackageText(definition) {
    const texts = await Promise.all(
      definition.files
        .filter(file => file.token && file.natures && file.natures.includes('license'))
        .map(file => this.attachmentStore.get(file.token))
    )
    return texts.join('\n\n')
  }
}

module.exports = (definitionService, attachmentStore) => new NoticeService(definitionService, attachmentStore)
