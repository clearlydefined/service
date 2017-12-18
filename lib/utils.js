// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

function normalizePackageName(namespace, name) {
  return (namespace ? `${namespace}/` : '') + name;
}

function getPackageCoordinates(req) {
  return {
    type: req.params.type,
    provider: req.params.provider,
    name: normalizePackageName(req.params.namespace, req.params.name),
    revision: req.params.revision,
    toolConfiguration: req.params.toolConfiguration,
    file: req.params.file
  };
}

function getPathFromCoordinates(packageCoordinates) {
  const c = packageCoordinates
  return [c.type, c.provider, c.name, c.revision, c.toolConfiguration, c.file].filter(s => s).join('/')
}

// search the summarized data for an entry that best matches the given tool spec
function findData(toolSpec, summarized) {
  const ordered = Object.getOwnPropertyNames(summarized)
    .filter(name => name.toLowerCase().startsWith(toolSpec))
    .sort((spec1, spec2) => this.getSpecVersion(spec1) - this.getSpecVersion(spec2));
  return ordered.length ? summarized[ordered[0]] : null;
}

function getSpecVersion(spec) {
  const index = spec.lastIndexOf('--');
  return index === -1 ? "0" : spec.substring(index);
}

module.exports = {
  normalizePackageName,
  getPackageCoordinates,
  getPathFromCoordinates,
  findData
};
