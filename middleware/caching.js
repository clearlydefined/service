// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = cacheProvider => (req, res, next) => {
  req.app.locals.cache = cacheProvider
  next()
}
