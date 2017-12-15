// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

const Curation = require('../business/curation');
const Harvester = require('../business/harvester');
const Summarizer = require('../business/summarizer');

// Gets the normalized data for a component with any applicable patches - typically used by a UI to display information about a component
router.get('/:type/:provider/:name/:revision', function (req, res, next) {
  const harvester = new Harvester.HarvesterService({ config: req.app.locals.config.harvester });
  harvester.get(req.params.type, req.params.provider, req.params.name, req.params.revision)
    .then(harvestedData => {
      const summarizer = new Summarizer.SummarizerService({ config: req.app.locals.config.summarizer });
      return summarizer.summarize(harvestedData);          
    })
    .then(summarizedData => {
      const curation = new Curation.CurationService({ config: req.app.locals.config.curation });
      const patch = curation.get(req.params.type, req.params.provider, req.params.name, req.params.revision);    
    })
    .then(patchedData => {
      res.status(200).send(patchedData);
    })
    .catch(err => {
      throw err;
    });
});

// Previews the normalized data for a component using the posted patch - typically used by a UI to preview the effect of a patch
router.post('/:type/:provider/:name/:revision/preview', function (req, res, next) {

});

module.exports = router;
