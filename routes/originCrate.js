// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')

router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://crates.io/api/v1/crates/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return response.status(200).send(answer.versions.map(x => x.num))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://crates.io/api/v1/crates?per_page=100&q=${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.crates.map(x => {
      return { id: x.name }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
