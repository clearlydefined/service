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
    revision: req.params.revision
  };
}

module.exports = {
  normalizePackageName: normalizePackageName,
  getPackageCoordinates: getPackageCoordinates
};
