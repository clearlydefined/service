// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')

router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    const fullName = namespace ? `${namespace}/${name}` : name
    const url = `https://rubygems.org/api/v1/versions/${fullName}.json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.map(entry => entry.number)
    return response.status(200).send(result)
  })
)

router.get(
  '/:namespace/:name?',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    // TODO decide if we want to tone down their scoring effect
    const searchTerm = name ? `${namespace}/${name}` : namespace
    const url = `https://rubygems.org/api/v1/search.json?query=${searchTerm}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.map(entry => {
      return { id: entry.name }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
