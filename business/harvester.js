// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Github = require('../lib/github');

// Responsible for retrieving harvested data from the store
class HarvesterService {
  constructor(options) {
    this.options = options;
  }

  get(type, provider, packageName, packageRevision) {

  }
}

module.exports = {
  HarvesterService: HarvesterService
}
