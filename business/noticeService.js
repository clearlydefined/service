// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('./definitionService').DefinitionService} DefinitionService
 * @typedef {import('./definitionService').Definition} Definition
 * @typedef {import('./noticeService').NoticeOutputFormat} NoticeOutputFormat
 * @typedef {import('./noticeService').NoticeOptions} NoticeOptions
 * @typedef {import('./noticeService').NoticeResult} NoticeResult
 * @typedef {import('./noticeService').NoticePackage} NoticePackage
 * @typedef {import('./noticeService').PackagesResult} PackagesResult
 * @typedef {import('./noticeService').AttachmentStore} AttachmentStore
 * @typedef {import('../providers/logging').Logger} Logger
 */

const { isDeclaredLicense } = require('../lib/utils')
const { get } = require('lodash')
const DocBuilder = require('tiny-attribution-generator/lib/docbuilder').default
const TextRenderer = require('tiny-attribution-generator/lib/outputs/text').default
const HtmlRenderer = require('tiny-attribution-generator/lib/outputs/html').default
const TemplateRenderer = require('tiny-attribution-generator/lib/outputs/template').default
const JsonRenderer = require('tiny-attribution-generator/lib/outputs/json').default
const JsonSource = require('tiny-attribution-generator/lib/inputs/json').default
const logger = require('../providers/logging/logger')

/**
 * Service for generating attribution notices from definitions.
 * Supports multiple output formats including text, HTML, and JSON.
 */
class NoticeService {
  /**
   * Creates a new NoticeService instance
   *
   * @param {DefinitionService} definitionService - Service for retrieving definitions
   * @param {AttachmentStore} attachmentStore - Store for retrieving license text attachments
   */
  constructor(definitionService, attachmentStore) {
    this.definitionService = definitionService
    this.attachmentStore = attachmentStore
    /** @type {Logger} */
    this.logger = logger()
  }

  /**
   * Generate an attribution notice for the given components.
   *
   * @param {EntityCoordinates[]} coordinates - Array of component coordinates to include
   * @param {NoticeOutputFormat | null} [output] - Output format ('text', 'html', 'template', 'json')
   * @param {NoticeOptions | null} [options] - Additional options for generation
   * @returns {Promise<NoticeResult>} The generated notice and summary
   * @throws {Error} if template renderer is used without a template option
   */
  async generate(coordinates, output, options) {
    options = options || {}
    this.logger.info('1:notice_generate:get_definitions:start', {
      ts: new Date().toISOString(),
      cnt: coordinates.length
    })
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

  /**
   * Get packages from definitions for notice generation
   *
   * @param {Record<string, Definition>} definitions - Map of definition IDs to definitions
   * @returns {Promise<PackagesResult>} The packages and warning lists
   * @private
   */
  async _getPackages(definitions) {
    /** @type {string[]} */
    const noDefinition = []
    /** @type {string[]} */
    const noLicense = []
    /** @type {string[]} */
    const noCopyright = []
    const packages = /** @type {NoticePackage[]} */ (
      (
        await Promise.all(
          Object.keys(definitions).map(async id => {
            const definition = definitions[id]
            if (!get(definition, 'described.tools[0]')) {
              noDefinition.push(id)
              return undefined
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
        )
      ).filter(x => x && isDeclaredLicense(x.license))
    )
    return { packages, noDefinition, noLicense, noCopyright }
  }

  /**
   * Get the appropriate renderer for the output format
   *
   * @param {NoticeOutputFormat | null | undefined} name - The output format name
   * @param {NoticeOptions} options - Renderer options
   * @returns {*} The renderer instance
   * @throws {Error} if template renderer is used without a template option
   * @throws {Error} if an unsupported renderer is requested
   * @private
   */
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

  /**
   * Get the license text content for a package
   *
   * @param {Definition} definition - The definition to get license text for
   * @returns {Promise<string>} The combined license texts
   * @private
   */
  async _getPackageText(definition) {
    if (!definition.files) return ''
    this.logger.info('2:1:notice_generate:get_single_package_files:start', {
      ts: new Date().toISOString(),
      coordinates: definition.coordinates.toString()
    })
    const texts = await Promise.all(
      definition.files
        .filter(
          file =>
            file.token &&
            file.natures &&
            file.natures.includes('license') &&
            file.path &&
            (file.path.indexOf('/') === -1 ||
              (definition.coordinates.type === 'npm' && file.path.startsWith('package/')))
        )
        .map(file => this.attachmentStore.get(/** @type {string} */ (file.token)))
    )
    this.logger.info('2:1:notice_generate:get_single_package_files:end', {
      ts: new Date().toISOString(),
      cnt: texts.length,
      coordinates: definition.coordinates.toString()
    })
    return texts.join('\n\n')
  }
}

/**
 * Factory function to create a NoticeService instance
 *
 * @param {DefinitionService} definitionService - Service for retrieving definitions
 * @param {AttachmentStore} attachmentStore - Store for retrieving license text attachments
 * @returns {NoticeService} A new NoticeService instance
 */
module.exports = (definitionService, attachmentStore) => new NoticeService(definitionService, attachmentStore)
