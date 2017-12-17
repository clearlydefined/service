// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Responsible for summarizing tool-specific format to a normalized summary schema:
//   package:
//     type: string
//     name: string
//     provider: string
//     revision: string
//   source_location:
//     provider: string
//     url: string
//     revision: string
//     path: string
//   copyright:
//     statements: string[]
//     holders: string[]
//     authors: string[]
//   license:
//     expression: string

class ScanCodeSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(packageCoordinates, toolConfiguration, data) {
    if (!data || !data.scancode_version)
      throw new Error('Not valid ScanCode data');

    const copyrightStatements = new Set();
    const copyrightHolders = new Set();
    const copyrightAuthors = new Set();
    const licenseExpressions = new Set();

    for (let file of data.files) {
      this._addArrayToSet(file.licenses, licenseExpressions, (license) => { return license.spdx_license_key });
      this._normalizeCopyrights(file.copyrights, copyrightStatements, copyrightHolders, copyrightAuthors);
    }

    return {
      package: packageCoordinates,
      copyright: {
        statements: Array.from(copyrightStatements),
        holders: Array.from(copyrightHolders),
        authors: Array.from(copyrightAuthors)
      },
      license: this._licenseSetToExpression(licenses)
    }
  }

  _licenseSetToExpression(licenses) {
    return Array.from(licenses).join(' AND ');
  }

  _normalizeCopyrights(copyrights, statements, holders, authors) {
    if (!copyrights || !copyrights.length)
      return;
    for (let copyright of copyrights) {
      this._addArrayToSet(copyright.statements, statements);
      this._addArrayToSet(copyright.holders, holders);
      this._addArrayToSet(copyright.authors, authors);
    }
  }

  _addArrayToSet(array, set, valueExtractor) {
    if (!array || !array.length)
      return;

    valueExtractor = valueExtractor || ((value) => value);
    for (let entry of array) {
      set.add(valueExtractor(entry));
    }
  }
}

module.exports = (options) => new ScanCodeSummarizer(options);
