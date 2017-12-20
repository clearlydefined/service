// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const express = require('express');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');

// Gets the summarized data for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace?/:name/:revision', function (request, result, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  let filter = null;
  return getFilter(packageCoordinates)
    .then(result => filter = result)
    .then(() =>
      harvestService.getAll(packageCoordinates))
    .then(raw =>
      summaryService.summarizeAll(packageCoordinates, filter, raw))
    .then(summarized =>
      aggregationService.process( packageCoordinates, summarized))
    .then(aggregated =>
      curationService.curate(packageCoordinates, aggregated))
    .then(curated =>
      result.status(200).send(curated))
    .catch(err => {
      throw err;
    });
});

function getFilter(packageCoordinates) {
  const descriptionCoordinates = { ...packageCoordinates, toolConfiguration: 'ClearlyDescribed--0', file: 'output.json' };
  return harvestService.get(descriptionCoordinates)
    .then(rawDescription =>
      curationService.curate(descriptionCoordinates, rawDescription)
        .then(description => buildFilter(description.described.dimensions)))
    .catch(error => null);
}

function buildFilter(dimensions) {
  const list = [...dimensions.test, ...dimensions.dev, ...dimensions.data];
  return file => !list.some(filter => minimatch(file, filter));
}

// Previews the summarized data for a component aggregated and with the POST'd path applied.
// Typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:namespace?/:name/:revision/preview', function (request, result, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
});

let harvestService;
let summaryService;
let aggregationService;
let curationService;

function setup(harvest, summary, aggregator, curation) {
  harvestService = harvest;
  summaryService = summary;
  aggregationService = aggregator;
  curationService = curation;
  return router;
}
module.exports = setup;
