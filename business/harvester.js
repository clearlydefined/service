// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Github = require('../lib/github');

// Responsible for retrieving harvested data from the store
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB-2.0: { /* tool-specific data format }
// }
class HarvesterService {
  constructor(options) {
    this.options = options;
  }

  get(packageCoordinates) {

  }
}

module.exports = {
  HarvesterService: HarvesterService
};
