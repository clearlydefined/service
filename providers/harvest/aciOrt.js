// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class AciOrt {

  constructor(options) {
    this.options = options;
  }

  harvest(spec) {
    console.log(`Harvesting ${spec}`);
    // Code here to call ACI
  }
}

module.exports = (options) => new AciOrt(options);