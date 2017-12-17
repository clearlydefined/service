// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');

let harvestService = null

// Gets a file that was harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.get(packageCoordinates, response);
});

// Gets a listing of files that were harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.list(packageCoordinates).then(result => 
    response.status(200).send(result));
});

// Gets a file that was harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.getAll(packageCoordinates, response).then(result =>
    response.status(200).send(result));
});

// Puts a file that was harvested - typically used by the ORT cache plugin
router.put('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvestService.store(packageCoordinates, request).then(result =>
    response.sendStatus(201))
});

function setup(service) {
  harvestService = service;
  return router;
}

module.exports = setup;
