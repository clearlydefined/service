// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');

let harvester = null

// Gets a file that was harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  harvester.get(packageCoordinates, response);
});

// Gets a listing of files that were harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvester.list(packageCoordinates).then(result => 
    response.status(200).send(result));
});

// Puts a file that was harvested - typically used by the ORT cache plugin
router.put('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration([^\/]+--[^\/]+)/:file', function (request, response, next) {
  const packageCoordinates = utils.getPackageCoordinates(request);
  return harvester.store(packageCoordinates, request, request.contentLength).then(result =>
    response.sendStatus(201))
});

function setup(service) {
  harvester = service;
  return router;
}

module.exports = setup;
