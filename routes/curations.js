// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');

// Get a proposed patch for a specific revision of a package
router.get('/:type/:provider/:namespace/:name/:revision/pr/:pr', asyncMiddleware(async (request, response) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return curationService.get(packageCoordinates, request.params.pr).then(result =>
    response.status(200).send(result));
}));

// Get an existing patch for a specific revision of a package
router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(async (request, response) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return curationService.get(packageCoordinates).then(result =>
    response.status(200).send(result));
}));

// Create a patch for a specific revision of a package
router.patch('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(async (request, response) => {
  const packageCoordinates = utils.toPackageCoordinates(request);
  return curationService.addOrUpdate(packageCoordinates, request.body).then(() =>
    response.sendStatus(200));
}));

let curationService;

function setup(service) {
  curationService = service;
  return router;
}

module.exports = setup;
