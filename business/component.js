// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Readable = require('stream').Readable;
const throat = require('throat');

class ComponentService {
  constructor(harvest, summary, aggregator, curation, componentStore) {
    this.harvestService = harvest;
    this.summaryService = summary;
    this.aggregationService = aggregator;
    this.curationService = curation;
    this.componentStore = componentStore;
  }

  async get(coordinates, pr) {
    if (pr) {
      const curation = this.curationService.get(coordinates, pr);
      return this.compute(coordinates, curation);
    }
    const storeCoordinates = Object.assign({}, coordinates, { tool: 'component', toolVersion: 1 });
    try {
      return await this.componentStore.get(storeCoordinates);
    } catch (error) {
      // cache miss
      return this.computeAndStore(coordinates, storeCoordinates);
    }
  }

  /**
   * Get all of the component entries available for the given coordinates. The coordinates must be
   * specified down to the revision. The result will have an entry per discovered component.
   *
   * @param {*} coordinatesList - an array of coordinate paths to list
   * @returns A list of summries for all components that have results and the results present
   */
  async getAll(coordinatesList) {
    const result = {};
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        const summary = await this.get(coordinates);
        const key = coordinates.asEntityCoordinates().toString();
        result[key] = summary;
      })
    );
    await Promise.all(promises);
    return result;
  }

  /**
   * Get the final representation of the specified component and optionally apply the indicated
   * curation.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation
   * @param {(number | string | Summary)} [curationSpec] - A PR number (string or number) for a proposed
   * curation or an actual curation object.
   * @returns {Summary} The fully rendered component definition
   */
  async compute(coordinates, curationSpec) {
    const curation = await this.curationService.get(coordinates, curationSpec);
    const raw = await this.harvestService.getAll(coordinates);
    // Summarize without any filters. From there we can get any dimensions and filter if needed.
    const summarized = await this.summaryService.summarizeAll(coordinates, raw);
    // if there is a file filter, summarize again to focus just on the desired files
    // TODO eventually see if there is a better way as summarizing could be expensive.
    // That or cache the heck out of this...
    const aggregated = await this.aggregationService.process(coordinates, summarized);
    return this.curationService.curate(coordinates, curation, aggregated);
  }

  async computeAndStore(coordinates, storeCoordinates) {
    const curated = await this.compute(coordinates);
    const stream = new Readable();
    stream.push(JSON.stringify(curated));
    stream.push(null); // end of stream
    this.componentStore.store(storeCoordinates, stream);
    return curated;
  }
}

module.exports = (harvest, summary, aggregator, curation, componentStore) =>
  new ComponentService(harvest, summary, aggregator, curation, componentStore);
