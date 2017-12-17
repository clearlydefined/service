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

module.exports = {
  normalizePackageName: normalizePackageName,
  getPackageCoordinates: getPackageCoordinates,
  getPathFromCoordinates: getPathFromCoordinates
};
