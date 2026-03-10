// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const express = require('express')
const router = express.Router()

router.get(
  '/',
  function (/** @type {import('express').Request} */ _req, /** @type {import('express').Response} */ res) {
    const msg = `{ "status": "OK", "version": "${version}", "sha": "${sha}" }`
    res.status(200).send(msg)
  }
)

module.exports = router

/** @type {string} */
let version
/** @type {string} */
let sha
/**
 * @param {string} buildsha
 * @param {string} appVersion
 */
function setup(buildsha, appVersion) {
  version = appVersion
  sha = buildsha
  return router
}
module.exports = setup
