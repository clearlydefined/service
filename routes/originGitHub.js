// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const throat = require('throat')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const { get, uniq } = require('lodash')

function getClient(request) {
  return get(request, 'app.locals.user.github.client') || get(request, 'app.locals.service.github.client')
}

router.get(
  '/:login/:repo/revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { login, repo } = request.params
      const github = getClient(request)
      const answer = await github.gitdata.getTags({ owner: login, repo, per_page: 100 })

      // Strip 'refs/tags/' from the beginning
      const tagName = item => item.ref.slice(10)

      const unsorted = await Promise.all(
        answer.data.map(
          throat(5, async item => {
            if (item.object.type === 'commit') return { tag: tagName(item), sha: item.object.sha }

            if (item.object.type !== 'tag') {
              return null
            }

            // we know now that we have an annotated tag, get the associated commit hash
            let response
            try {
              response = await github.gitdata.getTag({ owner: login, repo, sha: item.object.sha })
            } catch (e) {
              console.error(e)
              return null
            }
            return { tag: tagName(item), sha: response.data.object.sha }
          })
        )
      )
      const result = unsorted.filter(x => x).sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0))
      return response.status(200).send(uniq(result))
    } catch (error) {
      console.error(error)
      if (error.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

router.get(
  '/:login/:repo?',
  asyncMiddleware(async (request, response) => {
    const { login, repo } = request.params
    const github = getClient(request)
    if (request.path.indexOf('/', 1) > 0) {
      const answer = await github.search.repos({
        q: `${repo || ''}+user:${login}+in:name+fork:true`,
        sort: 'stars',
        per_page: 100
      })
      const result = answer.data.items.map(item => {
        return { id: item.full_name }
      })
      return response.status(200).send(result)
    }
    const answer = await github.search.users({ q: `${login}+repos:>0`, sort: 'repositories', per_page: 100 })
    const result = answer.data.items.map(item => {
      return { id: item.login }
    })
    return response.status(200).send(result)
  })
)

function setup() {
  return router
}

module.exports = setup
