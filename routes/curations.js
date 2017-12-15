// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

const Curation = require('../business/curation');
const utils = require('../lib/utils');

// Creates or updates a patch for a specific revision of a package - typically used by a UI that enables interactive curation
router.patch('/:type/:provider/:namespace?/:name/:revision', function (req, res, next) {
  const packageCoordinates = utils.getPackageCoordinates(req);
  const branchName = req['requestId'];
  const curation = new Curation.CurationService({config: req.app.locals.config.curation});
  try {
    await curation.addOrUpdate(branchName, packageCoordinates, req.body)
      .then(result => {
        res.status(200).send(result);
      })
      .catch(err => {
        throw err;
      });
  } catch(err) {
    next(err);
  }
});

module.exports = router;
