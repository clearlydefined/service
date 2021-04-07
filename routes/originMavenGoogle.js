// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { promisify } = require('util')
const parseString = promisify(require('xml2js').parseString)
const { uniq } = require('lodash')

// Get versions
router.get(
  '/:group/:artifact/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { group, artifact } = request.params
      const groupFullPath = `${group.replace(/\./g, '/')}`
      const url = `https://dl.google.com/android/maven2/"${groupFullPath}"/"${artifact}"/group-index.xml`
      const answerXml = await requestPromise({ url, method: 'GET', json: false })
      const answer = await parseString(answerXml)
      const result = answer.response.docs.map(item => item.v)
      return response.status(200).send(uniq(result))
    } catch (error) {
      if (error.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

function setup() {
  return router
}

module.exports = setup
