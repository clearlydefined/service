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

  summarize(packageCoordinates, filter, harvested) {
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data');

    const data = harvested.content;
    const copyrightStatements = new Set();
    const copyrightHolders = new Set();
    const copyrightAuthors = new Set();
    const licenseExpressions = new Set();

    const filteredFiles = filter ? data.files.filter(file => filter(file.path)) : data.files;
    for (let file of filteredFiles) {
      this._addArrayToSet(file.licenses, licenseExpressions, (license) => { return license.spdx_license_key; });
      this._normalizeCopyrights(file.copyrights, copyrightStatements, copyrightHolders, copyrightAuthors);
    }

    return {
      package: packageCoordinates,
      licensed: {
        copyright: {
          statements: Array.from(copyrightStatements).sort(),
          holders: Array.from(copyrightHolders).sort(),
          authors: Array.from(copyrightAuthors).sort()
        },
        license: this._licenseSetToExpression(licenseExpressions)
      }
    };
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
