// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const router = require('express').Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');
const EntityCoordinates = require('../lib/entityCoordinates');
const bodyParser = require('body-parser');

// Gets a given harvested file
router.get('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion', asyncMiddleware(async (request, response) => {
  const coordinates = utils.toResultCoordinatesFromRequest(request);
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.get(coordinates, response);
      // some harvest services will stream on the response and trigger sending
      return response.headersSent ? null : response.status(200).send(result);
    }
    case 'summary': {
      const raw = await harvestStore.get(coordinates);
      const filter = await getFilter(coordinates);
      const result = await summarizeService.summarize(coordinates, filter, raw);
      return response.status(200).send(result);
    }
    case 'list': {
      const result = await harvestStore.list(coordinates);
      return response.status(200).send(result);
    }
    default:
      throw new Error(`Invalid request form: ${request.query.form}`);
  }
}));

async function getFilter(coordinates) {
  try {
    const descriptionCoordinates = { ...coordinates, tool: 'clearlydescribed' };
    const rawDescription = await harvestStore.get(descriptionCoordinates);
    return buildFilter(rawDescription.dimensions);
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

// Gets ALL the harvested data for a given component revision
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(async (request, response) => {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw': {
      const result = await harvestStore.getAll(coordinates);
      return response.status(200).send(result);
    }
    case 'summary': {
      const raw = await harvestStore.getAll(coordinates);
      const filter = await getFilter(coordinates);
      const summarized = await summarizeService.summarizeAll(coordinates, filter, raw);
      return response.status(200).send(summarized);
    }
    case 'list': {
      const list = await harvestStore.list(coordinates);
      return response.status(200).send(list);
    }
    default:
      throw new Error(`Invalid request form: ${request.query.form}`);
  }
}));

// Get a list of the harvested data that we have that matches the url as a prefix
router.get('/:type?/:provider?/:namespace?/:name?/:revision?/:tool?', asyncMiddleware(async (request, response) => {
  if (request.query.form.toLowerCase() === 'list') {
    const coordinates = utils.toResultCoordinatesFromRequest(request);
    const result = await harvestStore.list(coordinates);
    return response.status(200).send(result);
  }
  throw new Error(`Invalid request form: ${request.query.form}`);
}));

// post a request to create a resoruce that is the summary of all harvested data available for 
// the components outlined in the POST body
router.post('/status', bodyParser.json(), asyncMiddleware(async (request, response) => {
  const coordinatesList = request.body.map(entry => EntityCoordinates.fromString(entry));
  const result = await harvestStore.listAll(coordinatesList, 'result');
  response.status(200).send(result);
}));

// Post a (set of) component to be harvested
router.post('/', bodyParser.json(), asyncMiddleware(async (request, response) => {
  await harvestService.harvest(request.body);
  response.sendStatus(201);
}));

let harvestService;
let harvestStore;
let summarizeService;

function setup(harvester, store, summarizer) {
  harvestService = harvester;
  harvestStore = store;
  summarizeService = summarizer;
  return router;
}

module.exports = setup;
