// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import express from 'express'
import type { Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import { promisify } from 'node:util'
import xml2js from 'xml2js'
import { callFetch as requestPromise } from '../lib/fetch.ts'

const parseString = promisify(xml2js.parseString)

//Example URL to request XML file with group ID "android.arch.navigation": https://dl.google.com/android/maven2/android/arch/navigation/group-index.xml

// Get versions
router.get(
  '/:group/:artifact/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const group = request.params.group as string
      const { artifact } = request.params
      const groupFullPath = `${group.replace(/\./g, '/')}`
      const url = `https://dl.google.com/android/maven2/${groupFullPath}/group-index.xml`
      const answerXml = await requestPromise({ url, method: 'GET', json: false })
      const answerJson = await parseString(answerXml)
      const result = JSON.parse(JSON.stringify(answerJson))
      const revisions = JSON.stringify(result[`${group}`][`${artifact}`][0]['$']['versions'])
      return response.status(200).send(JSON.parse(revisions).split(','))
    } catch {
      return response.status(404).send('No revisions found due to an internal error.')
    }
  })
)

// Search
router.get(
  '/:group{/:artifact}',
  asyncMiddleware(async (_request, response) => {
    return response.status(404).send('Search not supported. Please specify group and artifact IDs.')
  })
)

function setup(): Router {
  return router
}

export default setup
