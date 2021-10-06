// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { isDeclaredLicense } = require('../lib/utils')
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
    this.logger.info('1:notice_generate:get_definitions:start', { ts: new Date().toISOString(), cnt: coordinates.length })
    const definitions = await this.definitionService.getAll(coordinates)
    this.logger.info('1:notice_generate:get_definitions:end', { ts: new Date().toISOString(), cnt: coordinates.length })
    this.logger.info('2:notice_generate:get_blobs:start', { ts: new Date().toISOString(), cnt: coordinates.length })
    const packages = await this._getPackages(definitions)
    this.logger.info('2:notice_generate:get_blobs:end', { ts: new Date().toISOString(), cnt: coordinates.length })
    const source = new JsonSource(JSON.stringify({ packages: packages.packages }))
    this.logger.info('3:notice_generate:render:start', { ts: new Date().toISOString(), cnt: coordinates.length })
    const renderer = this._getRenderer(output, options)
    const docbuilder = new DocBuilder(renderer)
    await docbuilder.read(source)
    const content = docbuilder.build()
    this.logger.info('3:notice_generate:render:end', { ts: new Date().toISOString(), cnt: coordinates.length })
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
        if (!isDeclaredLicense(get(definition, 'licensed.declared'))) noLicense.push(id)
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
    )).filter(x => x && isDeclaredLicense(x.license))
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
    this.logger.info('2:1:notice_generate:get_single_package_files:start', { ts: new Date().toISOString(), coordinates: definition.coordinates.toString() })
    const texts = await Promise.all(
      definition.files
        .filter(file =>
          file.token
          && file.natures
          && file.natures.includes('license')
          && file.path
          && (
            file.path.indexOf('/') === -1
            || (definition.coordinates.type === 'npm' && file.path.startsWith('package/'))
          ))
        .map(file => this.attachmentStore.get(file.token))
    )
    this.logger.info('2:1:notice_generate:get_single_package_files:end', { ts: new Date().toISOString(), cnt: texts.length, coordinates: definition.coordinates.toString() })
    return texts.join('\n\n')
  }
}

module.exports = (definitionService, attachmentStore) => new NoticeService(definitionService, attachmentStore)
