// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */

const throat = require('throat')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { get, uniq } = require('lodash')

let logger = require('../providers/logging/logger')()

/** @param {Request} request */
function getClient(request) {
  return get(request, 'app.locals.user.github.client') || get(request, 'app.locals.service.github.client')
}

// GitHub API documentation: https://docs.github.com/en/rest
router.get(
  '/:login/:repo/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const login = /** @type {string} */ (request.params.login)
      const repo = /** @type {string} */ (request.params.repo)
      const github = getClient(request)

      // check response schema: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repository-tags
      const answer = await github.rest.repos.listTags({ owner: login, repo, per_page: 100 })

      const unsorted = await Promise.all(
        answer.data.map(
          throat(5, async item => {
            try {
              const response = await github.rest.git.getTag({
                owner: login,
                repo,
                tag_sha: item.commit.sha
              })

              return { tag: item.name, sha: response.data.object.sha }
            } catch (e) {
              const err = /** @type {any} */ (e)
              // If the tag_sha is not an annotated tag (likely 404), fallback to lightweight tag
              if (err.status === 404) {
                logger.warn('Annotated tag not found, using lightweight tag', {
                  tagName: item.name,
                  commitSha: item.commit.sha
                })
                return { tag: item.name, sha: item.commit.sha }
              }
              logger.error('Error fetching tag details', {
                tagName: item.name,
                error: err
              })
              throw err
            }
          })
        )
      )
      const result = unsorted.filter(x => x).sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0))
      return response.status(200).send(uniq(result))
    } catch (e) {
      const error = /** @type {any} */ (e)
      logger.error('Error in /:login/:repo/revisions route', { error })
      if (error.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

router.get(
  '/:login{/:repo}',
  asyncMiddleware(async (request, response) => {
    const login = /** @type {string} */ (request.params.login)
    const repo = /** @type {string} */ (request.params.repo)
    const github = getClient(request)
    if (request.path.indexOf('/', 1) > 0) {
      const answer = await github.search.repos({
        q: `${repo || ''}+user:${login}+in:name+fork:true`,
        sort: 'stars',
        per_page: 100
      })
      const result = answer.data.items.map((/** @type {any} */ item) => {
        return { id: item.full_name }
      })
      return response.status(200).send(result)
    }
    const answer = await github.search.users({ q: `${login}+repos:>0`, per_page: 100 })
    const result = answer.data.items.map((/** @type {any} */ item) => {
      return { id: item.login }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
