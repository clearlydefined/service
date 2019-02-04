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
    const definitions = await this.definitionService.getAll(coordinates)
    const packages = await this._getPackages(definitions)
    const source = new JsonSource(JSON.stringify({ packages: packages.packages }))
    const renderer = this._getRenderer(output, options)
    const docbuilder = new DocBuilder(renderer)
    await docbuilder.read(source)
    const content = docbuilder.build()
    return {
      content,
      summary: {
        total: coordinates.length,
        warnings: {
          noDefinition: packages.noDefinition,
          noLicense: packages.noLicense,
          noCopyright: packages.noCopyright
        }
      }
    }
  }

  async _getPackages(definitions) {
    const noDefinition = []
    const noLicense = []
    const noCopyright = []
    const packages = (await Promise.all(
      Object.keys(definitions).map(async id => {
        const definition = definitions[id]
        if (!get(definition, 'described.tools[0]')) {
          noDefinition.push(id)
          return
        }
        const declaredLicense = get(definition, 'licensed.declared')
        if (!declaredLicense || declaredLicense === 'NOASSERTION') noLicense.push(id)
        if (!get(definition, 'licensed.facets.core.attribution.parties[0]')) noCopyright.push(id)
        return {
          name: [definition.coordinates.namespace, definition.coordinates.name].filter(x => x).join('/'),
          version: get(definition, 'coordinates.revision'),
          license: get(definition, 'licensed.declared'),
          copyrights: get(definition, 'licensed.facets.core.attribution.parties'),
          website: get(definition, 'described.projectWebsite') || '',
          text: await this._getPackageText(definition)
        }
      })
    )).filter(x => x && x.license && x.license !== 'NOASSERTION')
    return { packages, noDefinition, noLicense, noCopyright }
  }

  _getRenderer(name, options) {
    if (!name) return new TextRenderer()
    switch (name) {
      case 'text':
        return new TextRenderer()
      case 'html':
        return new HtmlRenderer(options.template)
      case 'template':
        if (!options.template) throw new Error('options.template is required for template renderer')
        return new TemplateRenderer(options.template)
      case 'json':
        return new JsonRenderer()
      default:
        throw new Error(`"${name}" is not a supported renderer`)
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
