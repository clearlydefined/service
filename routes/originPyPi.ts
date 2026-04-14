// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import express from 'express'
import type { Router } from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import lodash from 'lodash'
import { callFetch as requestPromise } from '../lib/fetch.ts'

const { uniq } = lodash

// PyPi API documentation: https://warehouse.pypa.io/api-reference/json.html
router.get(
  '/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const name = request.params.name as string
    const answer = await getPypiData(name)
    const result = answer?.releases ? Object.keys(answer.releases) : []
    result.reverse()
    return response.status(200).send(uniq(result))
  })
)

router.get(
  '/:name',
  asyncMiddleware(async (request, response) => {
    const name = request.params.name as string
    const answer = await getPypiData(name)
    const result = answer?.info ? [{ id: answer.info.name }] : []
    return response.status(200).send(result)
  })
)
async function getPypiData(name: string) {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
  try {
    return await requestPromise({ url, method: 'GET', json: true })
  } catch (e) {
    const error = e as any
    if (error.statusCode === 404) {
      return {}
    }
    throw error
  }
}
function setup(testflag = false): Router {
  if (testflag) {
    const _router = router as any
    _router._getPypiData = getPypiData
  }
  return router
}

export default setup
