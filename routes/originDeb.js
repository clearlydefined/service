// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')

// APIs documentation: https://sources.debian.org/doc/api/
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://sources.debian.org/api/src/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.versions.map(version => version.version)
    return response.send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://sources.debian.org/api/search/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.results.other.map(entry => {
      return { id: entry.name }
    })
    if (answer.results.exact) {
      result.unshift({ id: answer.results.exact.name })
    }
    return response.send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
