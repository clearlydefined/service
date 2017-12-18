// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const minimatch = require('minimatch');
const utils = require('../lib/utils');

// Gets a given harvested file
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file?', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  switch ((request.query.form || 'summary').toLowerCase()) {
    case 'streamed':
    case 'raw':
      return harvestService.get(packageCoordinates, response).then(result => {
        if (!response.headersSent)
          // some harvest services will stream on the response and trigger sending
          response.status(200).send(result)
      });
    case 'summary':
      return harvestService.get(packageCoordinates).then(raw => {
        return getFilter(packageCoordinates).then(filter => {
          raw = request.params.file ? { [request.params.file]: raw } : raw;
          return summarizeService.summarize(packageCoordinates, packageCoordinates.toolConfiguration, filter, raw);
        });
      }).then(result =>
        response.status(200).send(result));
    case 'list':
      return harvestService.list(packageCoordinates).then(result =>
        response.status(200).send(result));
    default:
      throw new Error(`Invalid request form: ${request.query.form}`);
  }
});

function getFilter(packageCoordinates) {
  const descriptionCoordinates = { ...packageCoordinates, toolConfiguration: 'ClearlyDescribed--0', file: 'output.json' };
  return harvestService.get(descriptionCoordinates)
    .then(description => buildFilter(description.dimensions))
    .catch(error => null);
}

function buildFilter(dimensions) {
  const list = [ ...dimensions.test, ...dimensions.dev, ...dimensions.data];
  return file => !list.some(filter => minimatch(file, filter));
}

// Gets a listing of harvested files in the system for a given tool configuration
// router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)', function (request, response, next) {
//   const packageCoordinates = utils.getPackageCoordinates(request);
//   return harvestService.list(packageCoordinates).then(result =>
//     response.status(200).send(result));
// });

// Gets ALL the harvested data for a given component revision
router.get('/:type/:provider/:namespace?/:name/:revision', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);

  let result = harvestService.getAll(packageCoordinates);
  if (!['streamed', 'raw'].includes(request.query.form.toLowerCase())) {
    result = result.then(raw => {
      return getFilter(packageCoordinates).then(filter =>
        summarizeService.summarizeAll(packageCoordinates, packageCoordinate.toolConfiguration, filter, raw));
    });
  }
  return result.then(final =>
    response.status(200).send(final));
});

// Puts harvested file
router.put('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.store(packageCoordinates, request).then(result =>
    response.sendStatus(201))
});

function setup(harvest, summarizer) {
  harvestService = harvest;
  summarizeService = summarizer;
  return router;
}

module.exports = setup;
