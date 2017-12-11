var express = require('express');
var router = express.Router();

router.patch('/:packageFormat/:repositoryName/:packageName/:packageVersion', function (req, res, next) {
  res.status(200).send({ status: 'OK' });
});

module.exports = router;