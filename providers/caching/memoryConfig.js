// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const memory = require('./memory')

function serviceFactory() {
  return memory({ defaultTtlSeconds: 60 * 60 })
}

module.exports = serviceFactory
