// Copyright (c) 2018, The Linux Foundation.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const express = require('express');
const utils = require('../lib/utils');
const BadgeCalculator = require('../business/badgeCalculator');

async function getComponentBadgeRouterShell(definitionService, request, response) {
  const link = await getComponentBadgeLink(definitionService, request);
  response.header('location', link);
  response.sendStatus(302);
}

async function getComponentBadgeLink(definitionService, request) {
  const coordinates = utils.toEntityCoordinatesFromRequest(request);
  const definition = await definitionService.get(coordinates, request.params.pr);
  return new BadgeCalculator(definition).getBadgeUrl();
}

function getRouter(definitionService) {
  const router = express.Router();
  router.get(
    '/:type/:provider/:namespace/:name/:revision',
    asyncMiddleware((request, response) =>
      getComponentBadgeRouterShell(definitionService, request, response)
    )
  );
  return router;
}
module.exports = { getRouter, getComponentBadgeLink };
