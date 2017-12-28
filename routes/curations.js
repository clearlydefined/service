// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');

// Get an existing patch for a specific revision of a package
router.get('/:type/:provider/:namespace/:name/:revision', async (request, response, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return curationService.get(packageCoordinates).then(result =>
    response.status(200).send(result));
});

router.patch('/:type/:provider/:namespace/:name/:revision', async (request, response, next) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return curationService.addOrUpdate(packageCoordinates, request.body).then(result =>
    response.sendStatus(200));
});

let curationService;

function setup(service) {
  curationService = service;
  return router;
}

module.exports = setup;
