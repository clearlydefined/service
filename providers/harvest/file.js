// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils');
const fs = require('fs');
const path = require('path');
const recursive = require("recursive-readdir");

// Responsible for storing and retrieving harvested data
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB/2.0: { /* tool-specific data format }
// }

const resultOrError = (resolve, reject) => (error, result) => error ? reject(error) : resolve(result);

class FileHarvestStore {
  constructor(options) {
    this.options = options;
  }

  list(packageCoordinates) {
    // TODO implement if we actually need this.
    return Promise.resolve([]);
  }

  async get(packageCoordinates, stream) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    const toolPath = `${this.options.location}/${packageCoordinates.type}/${name}`;
    const latest = await this._findLatest(toolPath);
    if (!latest)
      return null;
    const filePath = `${toolPath}/${latest}.json`;
    if (stream)
      return new Promise((resolve, reject) => {
        const read = fs.createReadStream(filePath);
        read.on('end', () => resolve(null));
        read.on('error', error => reject(error));
        read.pipe(stream);
      });
    return new Promise((resolve, reject) =>
      fs.readFile(filePath, resultOrError(resolve, reject))
    ).then(result =>
      JSON.parse(result));
  }

  async getAll(packageCoordinates) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    const path = `${this.options.location}/${packageCoordinates.type}/${name}`;
    // Note that here we are assuming the number of blobs will be small-ish (<10) and 
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const files = await recursive(path);
    const contents = await Promise.all(files.map(file => {
      return new Promise((resolve, reject) =>
        fs.readFile(file, (error, data) =>
          error ? reject(error) : resolve({ name: file, content: JSON.parse(data) })));
    }));
    return contents.reduce((result, entry) => {
      const segments = entry.name.replace(/\\/g, '/').split('/');
      const tool = segments[segments.length - 2];
      const toolVersion = segments[segments.length - 1].replace('.json', '');
      const current = result[tool] = result[tool] || {};
      current[toolVersion] = entry.content;
      return result;
    }, {});
  }

  _findLatest(filePath) {
    return new Promise((resolve, reject) => {
      fs.readdir(filePath, (error, list) => {
        if (error)
          reject(error);
        const result = list.map(entry =>
          entry.endsWith('.json') ? path.basename(entry).slice(0, -5) : null);
        resolve(utils.getLatestVersion(result.filter(e => e)));
      });
    });
  }

  store(packageCoordinates, stream) {
    return new Promise((resolve, reject) => {
      const name = utils.toPathFromCoordinates(packageCoordinates);
      const path = `${this.options.location}/${packageCoordinates.type}/${name}.json`;
      stream.pipe(fs.createWriteStream(path, resultOrError(resolve, reject)));
    });
  }
}

module.exports = options => new FileHarvestStore(options);
