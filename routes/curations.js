const Curation = require('../business/curation');
const express = require('express');
const router = express.Router();

router.patch('/:packageFormat/:repositoryName/:packageName/:packageVersion', function (req, res, next) {
  const branchName = req['requestId'];
  const curation = new Curation.CurationService({config: req.app.locals.config});
  curation.addOrUpdate(branchName, req.params.packageFormat, req.params.repositoryName, req.params.packageName, req.params.packageVersion, req.body)
    .then(result => {
      res.status(200).send(result);
    })
    .catch(err => {
      throw err;
    });
});

module.exports = router;