// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for taking multiple normalized responses and summarizing them into a single response
class SummarizerService {
  constructor(options) {
    this.options = options;
  }

  summarize(type, provider, packageName, packageRevision, harvestedData) {

  }
}

module.exports = {
  SummarizerService: SummarizerService
}
