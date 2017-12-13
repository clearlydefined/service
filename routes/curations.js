const Curation = require('../business/curation');
const express = require('express');
const router = express.Router();

router.patch('/:type/:provider/:name/:version', function (req, res, next) {
  const branchName = req['requestId'];
  const curation = new Curation.CurationService({config: req.app.locals.config});
  curation.addOrUpdate(branchName, req.params.type, req.params.provider, req.params.name, req.params.version, req.body)
    .then(result => {
      res.status(200).send(result);
    })
    .catch(err => {
      throw err;
    });
});

module.exports = router;