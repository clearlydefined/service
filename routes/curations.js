// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

const Curation = require('../business/curation');

// Creates or updates a patch for a specific revision of a package - typically used by a UI that enables interactive curation
router.patch('/:type/:provider/:name/:revision', function (req, res, next) {
  const branchName = req['requestId'];
  const curation = new Curation.CurationService({config: req.app.locals.config.curation});
  curation.addOrUpdate(branchName, req.params.type, req.params.provider, req.params.name, req.params.revision, req.body)
    .then(result => {
      res.status(200).send(result);
    })
    .catch(err => {
      throw err;
    });
});

module.exports = router;
