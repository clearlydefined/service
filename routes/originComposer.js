// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')

router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://packagist.org/packages/${name}.json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.package.versions
    return response.status(200).send(result)
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://packagist.org/packages/${name}.json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.package
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
