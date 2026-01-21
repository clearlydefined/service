// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('express').RequestHandler} RequestHandler */
/** @typedef {import('@octokit/rest').Octokit} OctokitType */
/** @typedef {import('../providers/caching').ICache} ICache */
/** @typedef {import('./github').GitHubMiddlewareOptions} GitHubMiddlewareOptions */
/** @typedef {import('./github').GitHubUserInfo} GitHubUserInfo */

const crypto = require('crypto')
const { Octokit } = require('@octokit/rest')
const asyncMiddleware = require('./asyncMiddleware')
const Github = require('../lib/github')
const { defaultHeaders } = require('../lib/fetch')

/** @type {GitHubMiddlewareOptions | null} */
let options = null
/** @type {ICache | null} */
let cache = null

/**
 * GitHub convenience middleware that injects a client into the request object
 * that is pre-configured for the current user. Also injects a cached copy
 * of relevant teams the user is a member of.
 *
 * @type {RequestHandler}
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

// Create and configure a GitHub service client and attach it to the request
/**
 * @param {Request} req - Express request object
 * @param {string} token - GitHub token
 * @returns {Promise<OctokitType>} The authenticated GitHub client
 */
async function setupServiceClient(req, token) {
  const client = Github.getClient({ token })
  if (!client) throw new Error('GitHub client could not be created. Please check your configuration.')
  req.app.locals.service = { github: { client } }
  return client
}

// Create and configure a GitHub user client and attach it to the request
/**
 * @param {Request} req - Express request object
 * @param {string | null} token - GitHub user token, or null for anonymous
 * @returns {Promise<OctokitType | null>} The authenticated GitHub client, or null if no token
 */
async function setupUserClient(req, token) {
  if (!token) {
    req.app.locals.user = { github: { client: null } }
    return null
  }
  // constructor and authenticate are inexpensive (just sets local state)
  const client = new Octokit({
    auth: token,
    headers: defaultHeaders
  })
  req.app.locals.user = { github: { client } }
  return client
}

// Get GitHub user info and attach it to the request
/**
 * @param {Request} req - Express request object
 * @param {string} cacheKey - Cache key for user info
 * @param {OctokitType} client - GitHub client
 * @returns {Promise<void>}
 */
async function setupInfo(req, cacheKey, client) {
  let info = await cache.get(cacheKey)
  if (!info) {
    info = await client.rest.users.getAuthenticated()
    info = { name: info.data.name, login: info.data.login, email: info.data.email }
    await cache.set(cacheKey, info)
  }
  req.app.locals.user.github._info = info
}

// Get the user's teams (from GitHub or the cache) and attach them to the request
/**
 * @param {Request} req - Express request object
 * @param {string | null} cacheKey - Cache key for team data
 * @param {OctokitType | null} client - GitHub client
 * @returns {Promise<void>}
 */
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
 * Fetch a list of teams a user belongs to filtered for the given org.
 *
 * @param {OctokitType} client - GitHubApi client
 * @param {string} org - org name to filter teams
 * @returns {Promise<string[]>} - list of teams
 */
async function getTeams(client, org) {
  try {
    const resp = await client.teams.listForAuthenticatedUser()
    return resp.data
      .filter((entry) => entry.organization.login === org)
      .map((entry) => entry.name)
  } catch (err) {
    const error = /** @type {Error & { code?: number; status?: number }} */ (err)
    if (error.status === 404 || error.code === 404) {
      console.error(
        'GitHub returned a 404 when trying to read team data. ' +
          'You probably need to re-configure your CURATION_GITHUB_TOKEN token with the `read:org` scope. (This only affects local development.)'
      )
    } else if ((error.status === 401 || error.code === 401) && error.message === 'Bad credentials') {
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

/**
 * Creates a cache key by hashing a token.
 *
 * @param {string} prefix - Prefix for the cache key
 * @param {string} token - Token to hash
 * @returns {Promise<string>} Cache key
 */
async function getCacheKey(prefix, token) {
  const hashedToken = await crypto.createHash('sha256').update(token).digest('hex')
  return `${prefix}.${hashedToken}`
}

/**
 * Factory function that creates the GitHub middleware.
 *
 * @param {GitHubMiddlewareOptions} authOptions - Configuration options including token and org
 * @param {ICache} authCache - Cache instance for storing user info and team data
 * @returns {RequestHandler} Express middleware
 */
module.exports = (authOptions, authCache) => {
  options = authOptions
  cache = authCache
  return middleware
}
