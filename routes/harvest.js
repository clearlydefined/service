// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

const Harvester = require('../business/harvester');

// Gets a listing of files that were harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:name/:revision/:toolConfiguration', function (req, res, next) {

});

// Gets a file that was harvested - typically used by the ORT cache plugin
router.get('/:type/:provider/:name/:revision/:toolConfiguration/:file', function (req, res, next) {
    
});

// Puts a file that was harvested - typically used by the ORT cache plugin
router.put('/:type/:provider/:name/:revision/:toolConfiguration/:file', function (req, res, next) {
    
});
    
module.exports = router;
