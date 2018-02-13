// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const utils = require('../lib/utils');
const badgeCalculator = require('../business/badgeCalculator');

async function getComponentBadgeRouterShell(componentService, request, result) {
  const link = await getComponentBadgeLink(componentService, request);
  result.status(200).send(link);
}

async function getComponentBadgeLink(componentService, request) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const pr = request.params.pr;
  const curated = await componentService.get(coordinates, pr);
  const link = badgeCalculator(curated).getBadgeUrl();
  return link;
}

function getRouter(componentService) {
  const router = express.Router();
  router.get(
    '/:type/:provider/:namespace/:name/:revision',
    asyncMiddleware((request, result) =>
      getComponentBadgeRouterShell(componentService, request, result)
    )
  );
  return router;
}
module.exports = { getRouter, getComponentBadgeLink };
