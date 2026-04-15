// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import express from 'express'
import asyncMiddleware from '../middleware/asyncMiddleware.ts'

const router = express.Router()

import { callFetch as requestPromise } from '../lib/fetch.ts'
import { deCodeSlashes } from '../lib/utils.ts'
import type { Logger } from '../providers/logging/index.js'
import logger from '../providers/logging/logger.ts'

let log: Logger

// Get versions
router.get(
  '/:namespace/:name/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { name } = request.params
      const namespace = request.params.namespace as string
      const namespacePath = `${deCodeSlashes(namespace)}`
      const url = `https://proxy.golang.org/${namespacePath}/${name}/@v/list`
      const answer = await requestPromise({ url, method: 'GET', json: true })

      // Split on new lines that are not followed by the end of the string
      // And convert into an array
      // This results in an empty string as the last element of the array
      // So we pop that element off
      const result = answer.split(/\n/)
      result.pop()

      return response.status(200).send(result)
    } catch (e) {
      const error = e as Error
      log.error('Error fetching Go module revisions.', {
        errorMessage: error.message
      })
      return response.status(404).send('No revisions found due to an internal error.')
    }
  })
)

// Search
router.get(
  '/:namespace/:name',
  asyncMiddleware(async (_request, response) => {
    return response.status(404).send('Search not supported. Please specify a namespace and name to get revisions')
  })
)

function setup(): Router {
  log = logger()
  return router
}

export default setup
