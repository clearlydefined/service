// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const extend = require('extend');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');
const _ = require('lodash');

// Gets the summarized data for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getComponent));
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getComponent));

async function getComponent(request, result) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const pr = request.params.pr;
  const curated = await componentService.get(coordinates, pr);
  result.status(200).send(curated);
}

// Get a list of the components for which we have any kind of data, harvested or curated.
router.get('/:type?/:provider?/:namespace?/:name?', asyncMiddleware(async (request, response) => {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const curated = await curationService.list(coordinates);
  const harvest = await harvestService.list(coordinates);
  const stringHarvest = harvest.map(c => c.toString());
  const result = _.union(stringHarvest, curated);
  response.status(200).send(result);
}));

/**
 * Get a filter function that picks files from the dimensions of the described component to include in the
 * result. Dimensions are things like source, test, data, dev, ... Each dimension has an array of
 * minimatch/glob style expressions that identify files to include in the summarization effort.
 * The dimensions are specified in the `described` neighborhood of the raw and/or curated data
 * for the given component.
 *
 * @param {Summary} [curation] - Curated information to use in building the filter.
 * @param {Summary} [harvested] - Harvested data to use in building the filter.
 * @returns {function} The requested filter function.
 */
async function getFilter(curation, harvested) { // eslint-disable-line no-unused-vars
  if (!curation && !harvested)
    return null;
  const joined = extend(true, {}, harvested, curation);
  const dimensions = joined.dimensions || null;
  return buildFilter(dimensions);
}

/**
 * Create a filter that excludes all element that match the glob entries in the given
 * dimension's test, dev and data properties.
 * @param {*} dimensions - An object whose propertes are arrays of glob style filters expressions.
 * @returns {function} - A filter function
 */
function buildFilter(dimensions) {
  if (!dimensions)
    return null;
  const list = [...dimensions.test, ...dimensions.dev, ...dimensions.data];
  if (list.length === 0)
    return null;
  return file => !list.some(filter => minimatch(file, filter));
}

// Previews the summarized data for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(async (request, result) => {
  if (!request.query.preview)
    return result.sendStatus(400);
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const curated = await componentService.compute(coordinates, request.body);
  result.status(200).send(curated);
}));

let harvestService;
let curationService;
let componentService;

function setup(harvest, curation, component) {
  harvestService = harvest;
  curationService = curation;
  componentService = component;
  return router;
}
module.exports = setup;
