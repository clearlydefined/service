// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');

// Gets the summarized data for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getPackage));
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getPackage));
async function getPackage(request, result, next) {
  const packageCoordinates = utils.toPackageCoordinates(request);
  const pr = request.params.pr;
  let filter = null;
  return getFilter(packageCoordinates, pr)
    .then(result => filter = result)
    .then(() =>
      harvestService.getAll(packageCoordinates))
    .then(raw =>
      summaryService.summarizeAll(packageCoordinates, filter, raw))
    .then(summarized =>
      aggregationService.process(packageCoordinates, summarized))
    .then(aggregated =>
      curationService.curate(packageCoordinates, pr, aggregated))
    .then(curated =>
      result.status(200).send(curated))
    .catch(err => {
      throw err;
    });
}

/**
 * Get a filter function that picks files from the dimensions of the described package to include in the
 * result. Dimensions are things like source, test, data, dev, ... Each dimension has an array of 
 * minimatch/glob style expressions that identify files to include in the summarization effort. 
 * The dimensions are specified in the `described` neighborhood of the raw and/or curated data 
 * for the given package.
 * 
 * @param {*} packageCoordinates 
 */
async function getFilter(packageCoordinates, pr) {
  try {
    const descriptionCoordinates = { ...packageCoordinates, tool: 'clearlydescribed' };
    const rawDescription = await harvestService.get(descriptionCoordinates);
    const description = await curationService.curate(descriptionCoordinates, pr, rawDescription);
    return buildFilter(description.described.dimensions);
  } catch (error) {
    return null;
  }
}

function buildFilter(dimensions) {
  if (!dimensions)
    return null;
  const list = [...dimensions.test, ...dimensions.dev, ...dimensions.data];
  return file => !list.some(filter => minimatch(file, filter));
}

// Previews the summarized data for a component aggregated and with the POST'd path applied.
// Typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:namespace/:name/:revision/preview', asyncMiddleware(async (request, result, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
}));

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
