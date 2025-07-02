// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
// @ts-nocheck
let logger

module.exports = loggerValue => {
  if (loggerValue && !logger) logger = loggerValue
  return logger
}
