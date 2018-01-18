// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const { promisify } = require('util');
const recursive = require('recursive-readdir');

// Responsible for storing and retrieving harvested data
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB/2.0: { /* tool-specific data format }
// }

const resultOrError = (resolve, reject) => (error, result) => error ? reject(error) : resolve(result);

class FileStore {
  constructor(options) {
    this.options = options;
  }

  list() {
    // TODO implement if we actually need this.
    return Promise.resolve([]);
  }

  async get(packageCoordinates, stream) {
    const filePath = await this._getFilePath(packageCoordinates);
    if (!filePath) {
      return null;
    }
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

  async _getFilePath(packageCoordinates) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    const toolPath = `${this.options.location}/${packageCoordinates.type}/${name}`;
    if (packageCoordinates.toolVersion)
      return toolPath + '.json';
    const latest = await this._findLatest(toolPath);
    if (!latest)
      return null;
    return `${toolPath}/${latest}.json`;
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
        if (error) {
          return reject(error);
        }
        const result = list.map(entry =>
          entry.endsWith('.json') ? path.basename(entry).slice(0, -5) : null);
        resolve(utils.getLatestVersion(result.filter(e => e)));
      });
    });
  }

  async store(packageCoordinates, stream) {
    const name = utils.toPathFromCoordinates(packageCoordinates);
    const filePath = `${this.options.location}/${packageCoordinates.type}/${name}.json`;
    const dirName = path.dirname(filePath);
    await promisify(mkdirp)(dirName);
    return new Promise((resolve, reject) => {
      stream.pipe(fs.createWriteStream(filePath, resultOrError(resolve, reject)));
    });
  }
}

module.exports = options => new FileStore(options);
