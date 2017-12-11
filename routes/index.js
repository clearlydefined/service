var express = require('express');
var router = express.Router();

/* GET / */
router.get('/', function(req, res, next) {
  res.status(200).send({status: 'OK'});
});

module.exports = router;
