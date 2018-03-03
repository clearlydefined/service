// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const extend = require('extend');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');
const _ = require('lodash');
const EntityCoordinates = require('../lib/entityCoordinates');

// Gets the definition for a component with any applicable patches. This is the main
// API for serving consumers and API
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(getDefinition));
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getDefinition));

async function getDefinition(request, response) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const pr = request.params.pr;
  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false ;
  const result = await definitionService.get(coordinates, pr, force);
  response.status(200).send(result);
}

// Get a list of the components for which we have any kind of definition.
router.get('/:type?/:provider?/:namespace?/:name?', asyncMiddleware(async (request, response) => {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const curated = await curationService.list(coordinates);
  const harvest = await harvestService.list(coordinates);
  const stringHarvest = harvest.map(c => c.toString());
  const result = _.union(stringHarvest, curated);
  response.status(200).send(result);
}));

/**
 * Get a filter function that picks files from the facets of the described component to include in the
 * result. Facets are things like core, test, data, dev, ... Each facet has an array of
 * minimatch/glob style expressions that identify files to include in the summarization effort.
 * The facets are specified in the `described` neighborhood of the raw and/or curated data
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
  const facets = joined.facets || null;
  return buildFilter(facets);
}

/**
 * Create a filter that excludes all element that match the glob entries in the given
 * facet's test, dev and data properties.
 * @param {*} facets - An object whose propertes are arrays of glob style filters expressions.
 * @returns {function} - A filter function
 */
function buildFilter(facets) {
  if (!facets)
    return null;
  const list = [...facets.test, ...facets.dev, ...facets.data];
  if (list.length === 0)
    return null;
  return file => !list.some(filter => minimatch(file, filter));
}

// Previews the definition for a component aggregated and with the POST'd curation applied.
// Typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(async (request, response) => {
  if (!request.query.preview)
    return response.sendStatus(400);
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const result = await definitionService.compute(coordinates, request.body);
  response.status(200).send(result);
}));

// POST a request to create a resource that is the list of definitions available for
// the components outlined in the POST body
router.post('/', asyncMiddleware(async (request, response) => {
  const coordinatesList = request.body.map(entry => EntityCoordinates.fromString(entry));
  // if running on localhost, allow a force arg for testing without webhooks to invalidate the caches
  const force = request.hostname.includes('localhost') ? request.query.force || false : false ;
  const result = await definitionService.getAll(coordinatesList, force);
  response.status(200).send(result);
}));

let harvestService;
let curationService;
let definitionService;

function setup(harvest, curation, definition) {
  harvestService = harvest;
  curationService = curation;
  definitionService = definition;
  return router;
}
module.exports = setup;
