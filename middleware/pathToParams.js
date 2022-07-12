// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { parseParamsFromPath } = require('../lib/utils')

module.exports = (request, response, next) => {
  if (request.params[0]) {
    const params = parseParamsFromPath(request.params[0])
    if (!params) return response.status(400).send('Need to provide type, provider, namespace, name and revision')
    request.params = { ...params, ...request.params }
  }
  next()
}