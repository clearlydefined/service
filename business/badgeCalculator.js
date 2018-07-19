// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Responsible for calculating what badge a component/definition has.
// For now we are just going to go with the simple:
// If license/copyright there it gets a 3. Only one of those it gets a 2. None, it gets a 1

const { get } = require('lodash')

const scoreToUrl = {
  0: 'https://img.shields.io/badge/ClearlyDefined-0-red.svg',
  1: 'https://img.shields.io/badge/ClearlyDefined-1-yellow.svg',
  2: 'https://img.shields.io/badge/ClearlyDefined-2-brightgreen.svg'
}

class BadgeCalculator {
  constructor(definition) {
    this.definition = definition
  }

  getBadgeUrl() {
    return scoreToUrl[this.definition.score]
  }
}

module.exports = BadgeCalculator
