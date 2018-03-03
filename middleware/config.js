// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const config = require('../lib/config')

module.exports = (req, res, next) => {
  if (req.app.locals.config) {
    return next()
  }

  req.app.locals.config = config
  return next()
}
