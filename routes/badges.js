// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const utils = require('../lib/utils');
const badgeCalculator = require('../business/badgeCalculator');

async function getComponentBadgeRouterShell(definitionService, request, result) {
  const link = await getComponentBadgeLink(definitionService, request);
  result.status(302).send(link);
}

async function getComponentBadgeLink(definitionService, request) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const pr = request.params.pr;
  const curated = await definitionService.get(coordinates, pr);
  const link = badgeCalculator(curated).getBadgeUrl();
  return link;
}

function getRouter(definitionService) {
  const router = express.Router();
  router.get(
    '/:type/:provider/:namespace/:name/:revision',
    asyncMiddleware((request, result) =>
      getComponentBadgeRouterShell(definitionService, request, result)
    )
  );
  return router;
}
module.exports = { getRouter, getComponentBadgeLink };
