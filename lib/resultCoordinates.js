// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('./entityCoordinates')

class ResultCoordinates {
  static fromString(path) {
    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespaceSpec, name, revision, tool, toolVersion] = path.split('/')
    const namespace = namespaceSpec === '-' ? null : namespaceSpec
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  static fromUrn(urn) {
    // eslint-disable-next-line no-unused-vars
    const [scheme, type, provider, namespace, name, revToken, revision, toolToken, tool, toolVersion] = urn.split(':')
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion)
  }

  constructor(type, provider, namespace, name, revision, tool, toolVersion) {
    const entity = new EntityCoordinates(type, provider, namespace, name, revision)
    this.type = entity.type
    this.provider = entity.provider
    this.namespace = entity.namespace
    this.name = entity.name
    this.revision = entity.revision
    this.tool = tool && tool.toLowerCase()
    this.toolVersion = toolVersion
  }

  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision, this.tool, this.toolVersion]
      .filter(s => s)
      .join('/')
  }

  asEntityCoordinates() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name, this.revision)
  }
}

module.exports = ResultCoordinates
