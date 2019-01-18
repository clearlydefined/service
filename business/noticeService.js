// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get } = require('lodash')
const DocBuilder = require('tiny-attribution-generator/lib/docbuilder').default
const TextRenderer = require('tiny-attribution-generator/lib/outputs/text').default
const HtmlRenderer = require('tiny-attribution-generator/lib/outputs/html').default
const TemplateRenderer = require('tiny-attribution-generator/lib/outputs/template').default
const JsonRenderer = require('tiny-attribution-generator/lib/outputs/json').default
const JsonSource = require('tiny-attribution-generator/lib/inputs/json').default

const logger = require('../providers/logging/logger')

class NoticeService {
  constructor(definitionService, attachmentStore) {
    this.definitionService = definitionService
    this.attachmentStore = attachmentStore
    this.logger = logger()
  }

  async generate(coordinates, output, options) {
    options = options || {}
    let renderer = this._getRenderer(output, options)
    const docbuilder = new DocBuilder(renderer)
    const result = await this.definitionService.getAll(coordinates)
    const packages = await Promise.all(
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
    const source = new JsonSource(JSON.stringify({ packages: packages.filter(x => x.license) }))
    await docbuilder.read(source)
    return docbuilder.build()
  }

  _getRenderer(output, options) {
    if (!output) return new TextRenderer()
    switch (output) {
      case 'text':
        return new TextRenderer()
      case 'html':
        return new HtmlRenderer(options.template)
      case 'template':
        if (!options.template) throw new Error('options.template is required for template output')
        return new TemplateRenderer(options.template)
      case 'json':
        return new JsonRenderer()
      default:
        throw new Error(`"${output}" is not a supported output`)
    }
  }

  async _getPackageText(definition) {
    if (!definition.files) return ''
    const texts = await Promise.all(
      definition.files
        .filter(file => file.token && file.natures && file.natures.includes('license'))
        .map(file => this.attachmentStore.get(file.token))
    )
    return texts.join('\n\n')
  }
}

module.exports = (definitionService, attachmentStore) => new NoticeService(definitionService, attachmentStore)
