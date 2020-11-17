// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')

router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    const fullName = namespace ? `${namespace}/${name}` : name
    const url = `https://packagist.org/packages/${fullName}.json`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = Object.getOwnPropertyNames(answer.package.versions)
      .map(version =>
        version.startsWith('v') && version[1] >= '0' && version[1] <= '9' ? version.substring(1) : version
      )
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:namespace/:name?',
  asyncMiddleware(async (request, response) => {
    const { namespace, name } = request.params
    const searchTerm = name ? `${namespace}/${name}` : namespace
    const url = `https://packagist.org/search.json?q=${searchTerm}&per_page=100`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.results.map(entry => {
      return { id: entry.name }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
