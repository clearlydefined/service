// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const router = express.Router();
const utils = require('../lib/utils');
const badgeCalculator = require('../business/badgeCalculator');

router.get('/:type/:provider/:namespace/:name/:revision', asyncMiddleware(getComponentBadge));

async function getComponentBadge(request, result) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const pr = request.params.pr;
  const curated = await componentService.get(coordinates, pr);
  const link = badgeCalculator(curated).getBadgeUrl();
  result.status(200).send(link);
}

let componentService;

function setup(harvest, curation, component) {
  componentService = component;
  return router;
}
module.exports = setup;
