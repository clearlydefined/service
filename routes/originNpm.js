// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const utils = require('../lib/utils')

router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://registry.npmjs.com'
    const { namespace, name } = request.params
    const fullName = namespace ? `${namespace}/${name}` : name
    const url = `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}` // npmjs doesn't handle the escaped version
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = Object.getOwnPropertyNames(answer.versions).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    return response.status(200).send(utils.filterForUniqueItemsOnly(result))
  })
)

router.get(
  '/:namespace/:name?',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    // TODO decide if we want to tone down their scoring effect
    const searchTerm = name ? `${namespace}/${name}` : namespace
    const url = `https://api.npms.io/v2/search?q=${searchTerm}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.results.map(entry => {
      return { id: entry.package.name }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
