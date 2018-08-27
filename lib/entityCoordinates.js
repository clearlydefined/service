// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const NAMESPACE = 0x4
const NAME = 0x2
const REVISION = 0x1
const NONE = 0

const toLowerCaseMap = {
  github: NAMESPACE | NAME
}

function normalize(value, provider, property) {
  if (!value) return value
  const mask = toLowerCaseMap[provider] || 0
  return mask & property ? value.toLowerCase() : value
}

class EntityCoordinates {
  static fromObject(spec) {
    if (!spec) return null
    if (spec.constructor === EntityCoordinates) return spec
    return new EntityCoordinates(spec.type, spec.provider, spec.namespace, spec.name, spec.revision)
  }

  static fromString(path) {
    if (!path) return null
    path = path.startsWith('/') ? path.slice(1) : path
    const [type, provider, namespace, name, revision] = path.split('/')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  static fromUrn(urn) {
    if (!urn) return null
    // eslint-disable-next-line no-unused-vars
    const [scheme, type, provider, namespace, name, revToken, revision] = urn.split(':')
    return new EntityCoordinates(type, provider, namespace, name, revision)
  }

  constructor(type, provider, namespace, name, revision) {
    this.type = type && type.toLowerCase()
    this.provider = provider && provider.toLowerCase()
    if (namespace && namespace !== '-') this.namespace = normalize(namespace, this.provider, NAMESPACE)
    this.name = normalize(name, this.provider, NAME)
    const normalizedRevision = normalize(revision, this.provider, REVISION)
    if (normalizedRevision) this.revision = normalizedRevision
  }

  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision].filter(s => s).join('/')
  }

  asRevisionless() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name)
  }

  asEntityCoordinates() {
    return this
  }
}

module.exports = EntityCoordinates
