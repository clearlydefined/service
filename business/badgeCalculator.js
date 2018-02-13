// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for calculating what badge a component/definition has.
// For now we are just going to go with the simple:
// If license/copyright there it gets a 3. Only one of those it gets a 2. None, it gets a 1

const _ = require("lodash");

const scoreToUrl = {
  0: "https://img.shields.io/badge/ClearlyDefined%20Score-0-red.svg",
  1: "https://img.shields.io/badge/ClearlyDefined%20Score-1-yellow.svg",
  2: "https://img.shields.io/badge/ClearlyDefined%20Score-2-brightgreen.svg"
};
class BadgeCalculator {
  constructor(definition) {
    this.definition = definition;
  }

  getBadgeUrl() {
    return scoreToUrl[this.calculate()];
  }

  // @todo we need to flesh this out
  // For now it just checks that a license and copyright holders are present
  calculate() {
    const hasLicense = _.get(this.definition, "licensed.license", false);
    const hasCopyright = _.get(
      this.definition,
      "licensed.copyright.holders[0]",
      false
    );
    if (hasLicense && hasCopyright) {
      return 2;
    }
    if (hasLicense || hasCopyright) {
      return 1;
    }
    return 0;
  }
}

module.exports = definition => new BadgeCalculator(definition);
