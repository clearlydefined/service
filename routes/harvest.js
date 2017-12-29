// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');
const bodyParser = require('body-parser');

// Gets a given harvested file
router.get('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion?', (request, response, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw':
      return harvestStore.get(packageCoordinates, response).then(result => {
        if (!response.headersSent)
          // some harvest services will stream on the response and trigger sending
          response.status(200).send(result);
      });
    case 'summary':
      return harvestStore.get(packageCoordinates).then(raw => {
        return getFilter(packageCoordinates).then(filter => {
          raw = request.params.file ? { [request.params.file]: raw } : raw;
          return summarizeService.summarize(packageCoordinates, packageCoordinates.tool, filter, raw);
        });
      }).then(result =>
        response.status(200).send(result));
    case 'list':
      return harvestStore.list(packageCoordinates).then(result =>
        response.status(200).send(result));
    default:
      throw new Error(`Invalid request form: ${request.query.form}`);
  }
});

function getFilter(packageCoordinates) {
  const descriptionCoordinates = { ...packageCoordinates, tool: 'clearlydescribed' };
  return harvestStore.get(descriptionCoordinates)
    .then(description => buildFilter(description.dimensions))
    .catch(error => null);
}

function buildFilter(dimensions) {
  const list = [...dimensions.test, ...dimensions.dev, ...dimensions.data];
  return file => !list.some(filter => minimatch(file, filter));
}

// Gets ALL the harvested data for a given component revision
router.get('/:type/:provider/:namespace/:name/:revision', (request, response, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);

  let result = harvestStore.getAll(packageCoordinates);
  if (!['streamed', 'raw'].includes(request.query.form.toLowerCase())) {
    result = result.then(raw => {
      return getFilter(packageCoordinates).then(filter =>
        summarizeService.summarizeAll(packageCoordinates, packageCoordinates.tool, filter, raw));
    });
  }
  return result.then(final =>
    response.status(200).send(final));
});

// Puts harvested file
router.put('/:type/:provider/:namespace/:name/:revision/:tool/:toolVersion?', (request, response, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return harvestStore.store(packageCoordinates, request).then(result =>
    response.sendStatus(201));
});

// Post a component to be harvested
router.post('/', bodyParser.json(), (request, response, next) => {
  return harvestService.harvest(request.body).then(result => {
    response.status(201).send(Object.assign(request.body, { build: { id: result.id } }));
  }).catch(err => {
    next(err);
  });
});

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
