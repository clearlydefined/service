// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { callFetch: requestPromise } = require('../lib/fetch')
const { promisify } = require('util')
const parseString = promisify(require('xml2js').parseString)

//Example URL to request XML file with group ID "android.arch.navigation": https://dl.google.com/android/maven2/android/arch/navigation/group-index.xml

// Get versions
router.get(
  '/:group/:artifact/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { group, artifact } = request.params
      const groupFullPath = `${group.replace(/\./g, '/')}`
      const url = `https://dl.google.com/android/maven2/${groupFullPath}/group-index.xml`
      const answerXml = await requestPromise({ url, method: 'GET', json: false })
      const answerJson = await parseString(answerXml)
      const result = JSON.parse(JSON.stringify(answerJson))
      const revisions = JSON.stringify(result[`${group}`][`${artifact}`][0]['$']['versions'])
      return response.status(200).send(JSON.parse(revisions).split(','))
    } catch (error) {
      return response.status(404).send('No revisions found')
    }
  })
)

// Search
router.get(
  '/:group/:artifact?',
  asyncMiddleware(async (request, response) => {
    return response.status(404).send('Search not supported. Please specify group and artifact IDs.')
  })
)

function setup() {
  return router
}

module.exports = setup
