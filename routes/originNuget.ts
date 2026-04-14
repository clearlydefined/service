// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import express from 'express'
import type { Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import lodash from 'lodash'
import { callFetch as requestPromise } from '../lib/fetch.ts'

const { uniq } = lodash

// Nuget API documentation: https://docs.microsoft.com/en-us/nuget/api/overview
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { name } = request.params
    const url = `${baseUrl}/autocomplete?id=${name}&prerelease=true`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    return response.status(200).send(uniq(answer.data))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const baseUrl = 'https://api-v2v3search-0.nuget.org'
    const { name } = request.params
    const url = `${baseUrl}/query?q=${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.data.map(
      (entry: any) => {
        return { id: entry.id }
      }
    )
    return response.status(200).send(result)
  })
)

function setup(): Router {
  return router
}

export default setup
