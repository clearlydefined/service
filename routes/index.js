// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const express = require('express')
const router = express.Router()

router.get('/', function(req, res) {
  const msg = `{ "status": "OK", "sha": "${sha}" }`
  res.status(200).send(msg)
})

module.exports = router

let sha
function setup(buildsha) {
  sha = buildsha
  return router
}
module.exports = setup
