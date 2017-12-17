// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');

let harvestService = null;
let summaryService = null;
let aggregationService = null;
let curationService = null;

// Gets the summarized data for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace?/:name/:revision', function (request, result, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.getAll(packageCoordinates)
    .then(summaryService.summarize.bind(summaryService, packageCoordinates))
    .then(aggregationService.process.bind(aggregationService, packageCoordinates))
    .then(curationService.curate.bind(curationService, packageCoordinates))
    .then(patchedData => {
      result.status(200).send(patchedData);
    })
    .catch(err => {
      throw err;
    });
});

// Previews the summarized data for a component aggregated and with the POST'd path applied.
// Typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:namespace?/:name/:revision/preview', function (request, result, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
});

function setup(harvest, summary, aggregator, curation) {
  harvestService = harvest;
  summaryService = summary;
  aggregationService = aggregator;
  curationService = curation;
  return router;
}
module.exports = setup;
