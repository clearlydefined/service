// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class ScanCodeSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(coordinates, harvested, filter = null) {
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data');
    
    const result = {};
    this.addLicenseInfo(result, coordinates, harvested, filter);
    return result;
  }

  addLicenseInfo(result, coordinates, harvested, filter) {
    const data = harvested.content;
    const copyrightHolders = new Set();
    const licenseExpressions = new Set();
    let unknownHolders = 0;
    let unknownLicenses = 0;

    const filteredFiles = filter ? data.files.filter(file => filter(file.path)) : data.files;
    for (let file of filteredFiles) {
      this._addArrayToSet(file.licenses, licenseExpressions, license => license.spdx_license_key);
      (!file.licenses || file.licenses.length === 0) && unknownLicenses++;
      const hasHolders = this._normalizeCopyrights(file.copyrights, copyrightHolders);
      !hasHolders && unknownHolders++;
    }

    result.licensed = {
      copyright: {
        holders: Array.from(copyrightHolders).sort(),
        unknown: unknownHolders
      },
      files: filteredFiles.length,
      license: {
        expression: this._licenseSetToExpression(licenseExpressions),
        unknown: unknownLicenses
      }
    };
  }

  _licenseSetToExpression(licenses) {
    const licenseArray =Array.from(licenses).filter(e => e);
    return licenseArray.length ? licenseArray.join(' and ') : null;
  }

  _normalizeCopyrights(copyrights, holders) {
    if (!copyrights || !copyrights.length)
      return false;
    let hasHolders = false;
    for (let copyright of copyrights) {
      this._addArrayToSet(copyright.holders, holders);
      hasHolders = hasHolders || copyright.holders.length;
    }
    return hasHolders;
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
