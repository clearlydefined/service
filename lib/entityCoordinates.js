// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const NAMESPACE = 0x4;
const NAME = 0x2;
const REVISION = 0x1;
const NONE = 0;

const toLowerCaseMap = {
  github: NAMESPACE | NAME,
  npmjs: NONE,
  mavencentral: NONE,
  mavencentralsource: NONE
};

function normalize(value, provider, property) {
  if (!value)
    return value;
  const mask = toLowerCaseMap[provider] || 0;
  return (mask & property) ? value.toLowerCase() : value;
}

class EntityCoordinates {

  static fromString(path) {
    path = path.startsWith('/') ? path.slice(1) : path;
    const [type, provider, namespaceSpec, name, revision] = path.split('/');
    const namespace = namespaceSpec === '-' ? null : namespaceSpec;
    return new EntityCoordinates(type, provider, namespace, name, revision);
  }

  constructor(type, provider, namespace, name, revision) {
    this.type = type && type.toLowerCase();
    this.provider = provider && provider.toLowerCase();
    this.namespace = normalize(namespace, this.provider, NAMESPACE);
    this.name = normalize(name, this.provider, NAME);
    this.revision = normalize(revision, this.provider, REVISION);
  }

  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null;
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision].filter(s => s).join('/');
  }

  asRevisionless() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name);
  }

  asEntityCoordinates() {
    return this;
  }
}

module.exports = EntityCoordinates;