// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')

// TODO: where does this come from? GitHub??
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://cocoapods.org/api/v1/pods/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return response.status(200).send(uniq(answer.versions.map(x => x.num)))
  })
)

// TODO: where does this come from? GitHub??
router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://cocoapods.org/api/v1/pods?per_page=100&q=${name}`
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
