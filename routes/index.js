// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT
const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.status(200).send({ status: 'OK' });
});

module.exports = router;
