// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import crypto from 'node:crypto'
import { Octokit } from '@octokit/rest'
import type { Request, RequestHandler } from 'express'
import { defaultHeaders } from '../lib/fetch.ts'
import * as Github from '../lib/github.ts'
import type { ICache } from '../providers/caching/index.js'
import asyncMiddleware from './asyncMiddleware.ts'

/**
 * GitHub user information retrieved from the GitHub API.
 */
export interface GitHubUserInfo {
  name: string | null
  login: string
  email: string | null
}

/**
 * GitHub-related data and methods attached to the request.
 */
export interface GitHubUserContext {
  client: Octokit | null
  _info?: GitHubUserInfo
  _teams?: string[]
  getInfo(): Promise<GitHubUserInfo>
  getTeams(): Promise<string[]>
}

/**
 * Service-level GitHub context attached to the request.
 */
export interface GitHubServiceContext {
  client: Octokit
}

/**
 * Options for configuring the GitHub middleware.
 */
export interface GitHubMiddlewareOptions {
  token: string
  org: string
}

/**
 * Express application locals extended with GitHub contexts.
 * These are attached by the GitHub middleware.
 */
export interface GitHubAppLocals {
  user: {
    github: GitHubUserContext
  }
  service: {
    github: GitHubServiceContext
  }
}

let options: GitHubMiddlewareOptions | null = null
let cache: ICache | null = null

/**
 * GitHub convenience middleware that injects a client into the request object
 * that is pre-configured for the current user. Also injects a cached copy
 * of relevant teams the user is a member of.
 */
const middleware: RequestHandler = asyncMiddleware(async (req, res, next) => {
  const authHeader = req.get('authorization')
  // if there is an auth header, it had better be Bearer
  if (authHeader && !authHeader.startsWith('Bearer ')) {
    res.status(401).end()
    return
  }

  const serviceToken = options!.token
  const serviceClient = await setupServiceClient(req, serviceToken)
  const userToken = authHeader ? authHeader.split(' ')[1] : null
  const userClient = await setupUserClient(req, userToken)

  req.app.locals.user.github.getInfo = async () => {
    if (!req.app.locals.user.github._info) {
      const infoCacheKey = userClient
        ? await getCacheKey('github.user', userToken!)
        : await getCacheKey('github.user', serviceToken)
      await setupInfo(req, infoCacheKey, userClient || serviceClient)
    }

    return req.app.locals.user.github._info!
  }

  req.app.locals.user.github.getTeams = async (): Promise<string[]> => {
    if (!req.app.locals.user.github._teams) {
      const teamCacheKey = userClient ? await getCacheKey('github.team', userToken!) : null
      await setupTeams(req, teamCacheKey, userClient)
    }

    return req.app.locals.user.github._teams!
  }

  next()
})

// Create and configure a GitHub service client and attach it to the request
async function setupServiceClient(req: Request, token: string): Promise<Octokit> {
  const client = Github.getClient({ token })
  if (!client) {
    throw new Error('GitHub client could not be created. Please check your configuration.')
  }
  req.app.locals.service = { github: { client } }
  return client
}

// Create and configure a GitHub user client and attach it to the request
async function setupUserClient(req: Request, token: string | null): Promise<Octokit | null> {
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
async function setupInfo(req: Request, cacheKey: string, client: Octokit): Promise<void> {
  let info = await cache!.get(cacheKey)
  if (!info) {
    info = await client.rest.users.getAuthenticated()
    info = { name: info.data.name, login: info.data.login, email: info.data.email }
    await cache!.set(cacheKey, info)
  }
  req.app.locals.user.github._info = info
}

// Get the user's teams (from GitHub or the cache) and attach them to the request
async function setupTeams(req: Request, cacheKey: string | null, client: Octokit | null): Promise<void> {
  // anonymous users are not members of any team
  if (!cacheKey || !client) {
    return
  }
  // check cache for team data; hash the token so we're not storing them raw
  let teams = await cache!.get(cacheKey)
  if (!teams) {
    teams = await getTeams(client, options!.org)
    await cache!.set(cacheKey, teams)
  }
  req.app.locals.user.github._teams = teams
}

/**
 * Fetch a list of teams a user belongs to filtered for the given org.
 */
async function getTeams(client: Octokit, org: string): Promise<string[]> {
  try {
    const resp = await client.teams.listForAuthenticatedUser()
    return resp.data.filter(entry => entry.organization.login === org).map(entry => entry.name)
  } catch (err) {
    const error = err as Error & { code?: number; status?: number }
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
 */
async function getCacheKey(prefix: string, token: string): Promise<string> {
  const hashedToken = await crypto.createHash('sha256').update(token).digest('hex')
  return `${prefix}.${hashedToken}`
}

/**
 * Factory function that creates the GitHub middleware.
 */
export default (authOptions: GitHubMiddlewareOptions, authCache: ICache): RequestHandler => {
  options = authOptions
  cache = authCache
  return middleware
}
