// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

const Harvester = require('../business/harvester');
const utils = require('../lib/utils');

// Gets a listing of files that were harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration', function (req, res, next) {
  const packageCoordinates = utils.getPackageCoordinates(req);
});

// Gets a file that was harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration/:file', function (req, res, next) {
  const packageCoordinates = utils.getPackageCoordinates(req);
});

// Puts a file that was harvested - typically used by the ORT cache plugin
router.put('/:type/:provider/:namespace?/:name/:revision/:toolConfiguration/:file', function (req, res, next) {
  const packageCoordinates = utils.getPackageCoordinates(req);
});
    
module.exports = router;
