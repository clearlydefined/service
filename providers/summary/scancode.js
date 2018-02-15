// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class ScanCodeSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(packageCoordinates, harvested, filter = null) {
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data');

    const data = harvested.content;
    const copyrightHolders = new Set();
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
          holders: Array.from(copyrightHolders).sort(),
        },
        license: this._licenseSetToExpression(licenseExpressions)
      }
    };
  }

  _licenseSetToExpression(licenses) {
    return Array.from(licenses).join(' and ');
  }

  _normalizeCopyrights(copyrights, statements, holders, authors) {
    if (!copyrights || !copyrights.length)
      return;
    for (let copyright of copyrights) {
      this._addArrayToSet(copyright.holders, holders);
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
