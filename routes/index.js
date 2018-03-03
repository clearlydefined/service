// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const express = require('express')
const router = express.Router()

router.get('/', function(req, res) {
  res.status(200).send({ status: 'OK' })
})

module.exports = router
