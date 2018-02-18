// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Readable = require('stream').Readable;
const throat = require('throat');

class DefinitionService {
  constructor(harvest, summary, aggregator, curation, store) {
    this.harvestService = harvest;
    this.summaryService = summary;
    this.aggregationService = aggregator;
    this.curationService = curation;
    this.definitionStore = store;
  }

  async get(coordinates, pr) {
    if (pr) {
      const curation = this.curationService.get(coordinates, pr);
      return this.compute(coordinates, curation);
    }
    const storeCoordinates = Object.assign({}, coordinates, { tool: 'definition', toolVersion: 1 });
    try {
      return await this.definitionStore.get(storeCoordinates);
    } catch (error) { // cache miss
      return this.computeAndStore(coordinates, storeCoordinates);
    }
  }

  /**
   * Get all of the definition entries available for the given coordinates. The coordinates must be
   * specified down to the revision. The result will have an entry per discovered definition. 
   * 
   * @param {*} coordinatesList - an array of coordinate paths to list
   * @returns A list of all components that have definitions and the defintions that are available
   */
  async getAll(coordinatesList) {
    const result = {};
    const promises = coordinatesList.map(throat(10, async coordinates => {
      const summary = await this.get(coordinates);
      const key = coordinates.asEntityCoordinates().toString();
      result[key] = summary;
    }));
    await Promise.all(promises);
    return result;
  }

  /**
   * Get the final representation of the specified definition and optionally apply the indicated
   * curation.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation
   * @param {(number | string | Summary)} [curationSpec] - A PR number (string or number) for a proposed
   * curation or an actual curation object.
   * @returns {Summary} The fully rendered definition
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
    const definition = await this.curationService.curate(coordinates, curation, aggregated);
    this._ensureSourceLocation(coordinates, definition);
    return definition;
  }

  _ensureSourceLocation(coordinates, definition) {
    if (definition.described && definitions.described.sourceLocation)
      return;
    // For source components there may not be an explicit harvested source location (it is self-evident)
    // Make it explicit in the definition
    switch (coordinates.provider) {
      case 'github':
        const location = {
          type: 'git',
          provider: 'github',
          url: `https://github.com/${coordinates.namespace}/${coordinates.name}`,
          revision: coordinates.revision
        }
        definition.described.sourceLocation = location;
        break;
      default:
        return;
    }
  }

  async computeAndStore(coordinates, storeCoordinates) {
    const curated = await this.compute(coordinates);
    const stream = new Readable();
    stream.push(JSON.stringify(curated, null, 2));
    stream.push(null); // end of stream
    this.definitionStore.store(storeCoordinates, stream);
    return curated;
  }
}

module.exports = (harvest, summary, aggregator, curation, store) =>
  new DefinitionService(harvest, summary, aggregator, curation, store);
