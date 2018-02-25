// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const { get } = require('lodash');

class ScanCodeSummarizer {

  constructor(options) {
    this.options = options;
  }

  summarize(coordinates, harvested, filter = null) {
    if (!harvested || !harvested.content || !harvested.content.scancode_version)
      throw new Error('Not valid ScanCode data');
    
    const result = {};
    this.addDescribedInfo(result, coordinates, harvested);
    this.addLicenseInfo(result, coordinates, harvested, filter);
    return result;
  }

  addDescribedInfo(result, coordinates, harvested) {
    const releaseDate = harvested._metadata.releaseDate;
    if (releaseDate)
      result.described = { releaseDate: releaseDate.trim() };
  }

  addLicenseInfo(result, coordinates, harvested, filter) {
    const data = harvested.content;
    const copyrightHolders = new Set();
    const licenseExpressions = new Set();
    const declaredLicenses = new Set();
    let unknownParties = 0;
    let unknownLicenses = 0;

    const filteredFiles = filter ? data.files.filter(file => filter(file.path)) : data.files;
    for (let file of filteredFiles) {
      this._addArrayToSet(file.licenses, licenseExpressions, license => license.spdx_license_key);
      (!file.licenses || file.licenses.length === 0) && unknownLicenses++;
      const hasHolders = this._normalizeCopyrights(file.copyrights, copyrightHolders);
      !hasHolders && unknownParties++;
      const asserted = get(file, 'packages[0].asserted_licenses');
      asserted && asserted.forEach(license => declaredLicenses.add(license));
      this._addLicenseFiles(file, declaredLicenses);
    }

    result.licensed = {
      attribution: {
        parties: Array.from(copyrightHolders).sort(),
        unknown: unknownParties
      },
      declared: this._licenseSetToExpression(declaredLicenses),
      discovered: {
        expression: this._licenseSetToExpression(licenseExpressions),
        unknown: unknownLicenses
      },
      files: filteredFiles.length,
    };
  }

  _addLicenseFiles(file, declaredLicenses) {
    // Look for license files at the root of the scanned code
    // TODO enhance in the future to cover more license management strategies.
    if (!['license', 'license.txt', 'license.md', 'license.html'].includes(file.path.toLowerCase()))
      return;
    if (!file.licenses)
      return;
    file.licenses.forEach(license => declaredLicenses.add(license.spdx_license_key));
  }

  _licenseSetToExpression(licenses) {
    const licenseArray = Array.from(licenses).filter(e => e);
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
