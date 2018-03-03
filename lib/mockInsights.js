// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const colors = require('colors')

module.exports = {
  trackEvent: function(properties) {
    console.log(colors.bgGreen('trackEvent:'), JSON.stringify(properties))
  },
  trackException: function(properties) {
    const exception = JSON.stringify(properties.exception, Object.getOwnPropertyNames(properties.exception))
    delete properties.exception
    console.error(
      colors.bgGreen('trackException:'),
      colors.red(`exception: ${exception}`),
      colors.magenta(JSON.stringify(properties))
    )
  },
  trackMetric: function(properties) {
    console.log(colors.bgGreen('trackMetric:'), JSON.stringify(properties))
  },
  trackTrace: function(properties) {
    console.log(colors.bgGreen('trackTrace:'), JSON.stringify(properties))
  }
}
