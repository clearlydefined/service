// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const utils = require('../lib/utils');
const azure = require('azure-storage');
const moment = require('moment');

// Responsible for storing and retrieving harvested data
//
// Return format should be:
//
// {
// toolA: { /* tool-specific data format },
// toolB-2.0: { /* tool-specific data format }
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
        lastModified: moment(entry.lastModified),
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

  store(packageCoordinates, stream, length) {
    return new Promise((resolve, reject) => {
      const name = utils.getPathFromCoordinates(packageCoordinates);
      stream.pipe(this.blobService.createWriteStreamToBlockBlob(this.containerName, name, (error, result, response) => {
        error ? reject(error) : resolve(response);
      }));
    })
  }
}

module.exports = AzBlobHarvesterService;