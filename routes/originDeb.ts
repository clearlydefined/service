// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import lodash from 'lodash'
import { callFetch as requestPromise } from '../lib/fetch.ts'

const { uniq } = lodash

// Debian API documentation: https://sources.debian.org/doc/api/
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://sources.debian.org/api/src/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.versions.map((version: any) => version.version)
    return response.send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const { name } = request.params
    const url = `https://sources.debian.org/api/search/${name}`
    const answer = await requestPromise({ url, method: 'GET', json: true })
    const result = answer.results.other.map(
      (entry: any) => {
        return { id: entry.name }
      }
    )
    if (answer.results.exact) {
      result.unshift({ id: answer.results.exact.name })
    }
    return response.send(result)
  })
)

function setup(): Router {
  return router
}

export default setup
