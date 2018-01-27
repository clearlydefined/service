// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const EntityCoordinates = require('./entityCoordinates');

class ResultCoordinates {

  static fromString(path) {
    path = path.startsWith('/') ? path.slice(1) : path;
    const [type, provider, namespaceSpec, name, revision, tool, toolVersion] = path.split('/');
    const namespace = namespaceSpec === '-' ? null : namespaceSpec;
    return new ResultCoordinates(type, provider, namespace, name, revision, tool, toolVersion);
  }

  constructor(type, provider, namespace, name, revision, tool, toolVersion) {
    this.type = type;
    this.provider = provider && provider.toLowerCase();
    this.namespace = namespace && namespace.toLowerCase();
    this.name = name;
    this.revision = revision;
    this.tool = tool && tool.toLowerCase();
    this.toolVersion = toolVersion;
  }

  toString() {
    // if there is a provider then consider the namespace otherwise there can't be one so ignore null
    const namespace = this.provider ? this.namespace || '-' : null;
    // TODO validate that there are no intermediate nulls
    return [this.type, this.provider, namespace, this.name, this.revision, this.tool, this.toolVersion].filter(s => s).join('/');
  }

  asEntityCoordinates() {
    return new EntityCoordinates(this.type, this.provider, this.namespace, this.name, this.revision);
  }
}

module.exports = ResultCoordinates;