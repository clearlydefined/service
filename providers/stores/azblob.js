// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const azure = require('azure-storage');
const AbstractStore = require('./abstractStore');

const resultOrError = (resolve, reject) => (error, result) => error ? reject(error) : resolve(result);
const responseOrError = (resolve, reject) => (error, result, response) => error ? reject(error) : resolve(response);

class AzBlobStore extends AbstractStore {
  constructor(options) {
    super();
    this.options = options;
    this.containerName = options.containerName;
  }

  get blobService() {
    const blobService = azure.createBlobService(this.options.connectionString).withFilter(new azure.LinearRetryPolicyFilter());
    Object.defineProperty(this, 'blobService', { value: blobService, writable: false, configurable: true });
    this.blobService.createContainerIfNotExists(this.containerName, () => { });
    return this.blobService;
  }

  async _list(coordinates) {
    const result = await new Promise((resolve, reject) => {
      const name = this._toStoragePathFromCoordinates(coordinates);
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject));
    });
    return result.entries.map(entry => entry.name);
  }

  _filter(list) {
    return list.filter(entry => entry.type !== 'deadletter');
  }

  /**
   * Get the results of running the tool specified in the coordinates on the entty specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *   
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get 
   * @param {WriteStream} [stream] - The stream onto which the output is written, if specified
   * @returns The result object if no stream is specified, otherwise the return value is unspecified. 
   */
  get(coordinates, stream) {
    let name = this._toStoragePathFromCoordinates(coordinates);
    if (!name.endsWith('.json'))
      name += '.json';
    if (stream)
      return new Promise((resolve, reject) => {
        this.blobService.getBlobToStream(this.containerName, name, stream, responseOrError(resolve, reject));
      });
    return new Promise((resolve, reject) => {
      this.blobService.getBlobToText(this.containerName, name, resultOrError(resolve, reject));
    }).then(result =>
      JSON.parse(result));
  }

  /**
   * Get all of the tool outputs for the given coordinates. The coordinates must be all the way down
   * to a revision. 
   * @param {EntityCoordinates} coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  getAll(coordinates) {
    const name = this._toStoragePathFromCoordinates(coordinates);
    // Note that here we are assuming the number of blobs will be small-ish (<10) and
    // a) all fit in memory reasonably, and
    // b) fit in one list call (i.e., <5000)
    const list = new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmentedWithPrefix(this.containerName, name, null, resultOrError(resolve, reject));
    });
    const contents = list.then(files => {
      return Promise.all(files.entries.map(file => {
        return new Promise((resolve, reject) => {
          this.blobService.getBlobToText(this.containerName, file.name, resultOrError(resolve, reject));
        }).then(result => {
          return { name: file.name, content: JSON.parse(result) };
        });
      }));
    });
    return contents.then(entries => {
      return entries.reduce((result, entry) => {
        const { tool, toolVersion } = this._toResultCoordinatesFromStoragePath(entry.name);
        const current = result[tool] = result[tool] || {};
        current[toolVersion] = entry.content;
        return result;
      }, {});
    });
  }

  // TODO consider not having this. All harvest content should be written by the harvest service (e.g., crawler)
  store(coordinates, stream) {
    return new Promise((resolve, reject) => {
      let name = this._toStoragePathFromCoordinates(coordinates);
      if (!name.endsWith('.json')) {
        name += '.json';
      }
      stream.pipe(this.blobService.createWriteStreamToBlockBlob(this.containerName, name, responseOrError(resolve, reject)));
    });
  }
}

module.exports = options => new AzBlobStore(options);
