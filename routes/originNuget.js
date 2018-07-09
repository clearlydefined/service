// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')

router.get(
  '/:namespace?/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { namespace, name } = request.params
    const fullName = namespace ? `${namespace}/${name}` : name
    const url = `${baseUrl}/autocomplete?id=${fullName}&prerelease=true`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return response.status(200).send(answer.data)
  })
)

router.get(
  '/:namespace/:name?',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { namespace, name } = request.params
    const fullName = name ? `${namespace}/${name}` : namespace
    const url = `${baseUrl}/query?q=${fullName}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.data.map(entry => {
      return { id: entry.title }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
