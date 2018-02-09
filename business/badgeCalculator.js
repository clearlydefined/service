// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for calculating what badge a component/definition has.
// For now we are just going to go with the simple:
// If license/copyright there it gets a 3. Only one of those it gets a 2. None, it gets a 1

const _ = require('lodash');

const scoreToUrl = {
  1: 'https://img.shields.io/badge/Clearly%20Defined%20Score-1-red.svg',
  2: 'https://img.shields.io/badge/Clearly%20Defined%20Score-2-yellow.svg',
  3: 'https://img.shields.io/badge/Clearly%20Defined%20Score-3-brightgreen.svg'
};
class BadgeCalculator {
  constructor(definition) {
    this.definition = definition;
  }

  getBadgeUrl() {
    return scoreToUrl[this.calculate()];
  }

  // @todo we need to flesh this out
  // For now it just checks that a license and copyright statements are present
  calculate() {
    const hasLicense = _.get(this.definition, 'licensed.license', false);
    const hasCopyright = _.get(this.definition, 'licensed.copyright.statements[0]', false);
    if (hasLicense && hasCopyright) {return 3;}
    if (hasLicense || hasCopyright) {return 2;}
    return 1;
  }
}

module.exports = definition => new BadgeCalculator(definition);