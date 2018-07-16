// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')

router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://launchpad.api.net/1.0/${name}/releases`
    const answer = await requestPromise({ url, method: 'GET' })
    // this is paged... need to grab the next url and continue until we get them all
    const result = answer && answer.entries ? Object.keys(answer.entries) : []
    result.reverse()
    return response.status(200).send(result)
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://launchpad.api.net/1.0/${name}`
    const answer = await requestPromise({ url, method: 'GET' })
    const result = answer && answer.info ? [{ id: answer.info.name }] : []
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
