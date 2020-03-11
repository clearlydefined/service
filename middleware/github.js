// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const crypto = require('crypto')
const GitHubApi = require('@octokit/rest')
const asyncMiddleware = require('./asyncMiddleware')
const Github = require('../lib/github')

let options = null
let cache = null

/**
 * GitHub convenience middleware that injects a client into the request object
 * that is pre-configured for the current user. Also injects a cached copy
 * of relevant teams the user is a member of.
 */
const middleware = asyncMiddleware(async (req, res, next) => {
  const authHeader = req.get('authorization')
  // if there is an auth header, it had better be Bearer
  if (authHeader && !authHeader.startsWith('Bearer ')) {
    res.status(401).end()
    return
  }

  const serviceToken = options.token
  const serviceClient = await setupServiceClient(req, serviceToken)
  const userToken = authHeader ? authHeader.split(' ')[1] : null
  const userClient = await setupUserClient(req, userToken)

  req.app.locals.user.github.getInfo = async () => {
    if (!req.app.locals.user.github._info) {
      const infoCacheKey = userClient
        ? await getCacheKey('github.user', userToken)
        : await getCacheKey('github.user', serviceToken)
      await setupInfo(req, infoCacheKey, userClient || serviceClient)
    }

    return req.app.locals.user.github._info
  }

  req.app.locals.user.github.getTeams = async () => {
    if (!req.app.locals.user.github._teams) {
      const teamCacheKey = userClient ? await getCacheKey('github.team', userToken) : null
      await setupTeams(req, teamCacheKey, userClient)
    }

    return req.app.locals.user.github._teams
  }

  next()
})

// Create and configure a GitHub user client and attach it to the request
async function setupServiceClient(req, token) {
  const client = Github.getClient({ token })
  req.app.locals.service = { github: { client } }
  return client
}

// Create and configure a GitHub user client and attach it to the request
async function setupUserClient(req, token) {
  if (!token) {
    req.app.locals.user = { github: { client: null } }
    return null
  }
  // constructor and authenticate are inexpensive (just sets local state)
  const client = new GitHubApi({ headers: { 'user-agent': 'clearlydefined.io' } })
  client.authenticate({ type: 'token', token })
  req.app.locals.user = { github: { client } }
  return client
}

// Get GitHub user info and attach it to the request
async function setupInfo(req, cacheKey, client) {
  let info = await cache.get(cacheKey)
  if (!info) {
    info = await client.users.get({})
    info = { name: info.data.name, login: info.data.login, email: info.data.email }
    await cache.set(cacheKey, info)
  }
  req.app.locals.user.github._info = info
}

// get the user's teams (from GitHub or the cache) and attach them to the request
async function setupTeams(req, cacheKey, client) {
  // anonymous users are not members of any team
  if (!cacheKey || !client) return null
  // check cache for team data; hash the token so we're not storing them raw
  let teams = await cache.get(cacheKey)
  if (!teams) {
    teams = await getTeams(client, options.org)
    await cache.set(cacheKey, teams)
  }
  req.app.locals.user.github._teams = teams
}

/**
 * Fetch a list of teams a user belogs to filtered for the given org.
 * @param {object} client - GitHubApi client
 * @param {string} org - org name to filter teams
 * @returns {Promise<Array<string>>} - list of teams
 */
async function getTeams(client, org) {
  try {
    const resp = await client.users.getTeams()
    return resp.data.filter(entry => entry.organization.login === org).map(entry => entry.name)
  } catch (err) {
    if (err.code === 404) {
      console.error(
        'GitHub returned a 404 when trying to read team data. ' +
        'You probably need to re-configure your CURATION_GITHUB_TOKEN token with the `read:org` scope. (This only affects local development.)'
      )
    } else if (err.code === 401 && err.message === 'Bad credentials') {
      // the token was bad. trickle up the problem so the user can fix
      throw err
    } else {
      // XXX: Better logging situation?
      console.error(err)
    }
    // in all other error cases assume the user has no teams. If they do then they can try again after the timeout
    return []
  }
}

async function getCacheKey(prefix, token) {
  const hashedToken = await crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
  return `${prefix}.${hashedToken}`
}

module.exports = (authOptions, authCache) => {
  options = authOptions
  cache = authCache
  return middleware
}
