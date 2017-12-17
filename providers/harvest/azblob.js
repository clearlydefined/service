// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const utils = require('../../lib/utils');
const azure = require('azure-storage');
const moment = require('moment');

// Responsible for storing and retrieving harvested data
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB--2.0: { /* tool-specific data format }
// }
class AzBlobHarvesterService {
  constructor(options) {
    this.options = options;
    this.containerName = options.containerName;
  }

  get blobService() {
    const blobService = azure.createBlobService(this.options.connectionString).withFilter(new azure.LinearRetryPolicyFilter())
    Object.defineProperty(this, "blobService", { value: blobService, writable: false, configurable: true });
    this.blobService.createContainerIfNotExists(this.containerName, () => { });
    return this.blobService
  }

  list(packageCoordinates) {
    return new Promise((resolve, reject) => {
      const name = utils.getPathFromCoordinates(packageCoordinates);
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, (error, result, response) => {
        error ? reject(error) : resolve(this.buildList(result));
      })
    });
  }

  buildList(result) {
    return result.entries.map(entry => {
      return {
        name: entry.name.substr(entry.name.lastIndexOf('/') + 1),
        lastModified: moment(entry.lastModified).format(),
        etag: entry.etag
      }
    });
  }

  get(packageCoordinates, stream) {
    return new Promise((resolve, reject) => {
      const name = utils.getPathFromCoordinates(packageCoordinates);
      this.blobService.getBlobToStream(this.containerName, name, stream, (error, result, response) => {
        error ? reject(error) : resolve(response);
      });
    })
  }

  getAll(packageCoordinates) {
    const name = utils.getPathFromCoordinates(packageCoordinates);
    const list = new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, (error, result, response) => {
        error ? reject(error) : resolve(result);
      })
    });
    const contents = list.then(files => {
      return Promise.all(files.entries.map(file => {
        return new Promise((resolve, reject) => {
          this.blobService.getBlobToText(this.containerName, file.name, (error, result, response) => {
            error ? reject(error) : resolve({ name: file.name, content: JSON.parse(result) });
          });
        })
      }));
    });
    return contents.then(entries => {
      return entries.reduce((result, entry) => {
        const segments = entry.name.split('/');
        const tool = segments[segments.length - 2];
        const name = segments[segments.length - 1];
        const current = result[tool] = result[tool] || {};
        current[name] = entry.content;
        return result;
      }, {})
    })
  }

  store(packageCoordinates, stream) {
    return new Promise((resolve, reject) => {
      const name = utils.getPathFromCoordinates(packageCoordinates);
      stream.pipe(this.blobService.createWriteStreamToBlockBlob(this.containerName, name, (error, result, response) => {
        error ? reject(error) : resolve(response);
      }));
    })
  }
}

module.exports = (config) => new AzBlobHarvesterService(config);