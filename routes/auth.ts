// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { URL } from 'node:url'
import { Octokit } from '@octokit/rest'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import express from 'express'
import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github'
import { defaultHeaders } from '../lib/fetch.ts'
import type { PermissionsConfig } from '../middleware/permissions.ts'

/**
 * Configuration options for the auth route module.
 */
export interface AuthOptions {
  /** GitHub OAuth App client ID (optional, falls back to PAT auth if not set) */
  clientId?: string
  /** GitHub OAuth App client secret */
  clientSecret?: string
  /** GitHub Personal Access Token for service-level operations */
  token: string
  /** GitHub organization name for filtering team memberships */
  org: string
  /** Permission configuration mapping permission names to team names */
  permissions: PermissionsConfig
}

/**
 * Endpoint URLs for OAuth callbacks and redirects.
 */
export interface AuthEndpoints {
  /** URL of the service API (used for OAuth callback URL) */
  service: string
  /** URL of the website/frontend (used for postMessage origin) */
  website: string
}

/**
 * GitHub user email information.
 */
export interface GitHubEmail {
  /** Email address */
  email: string
  /** Whether this is the primary email */
  primary: boolean
  /** Whether the email is verified */
  verified: boolean
  /** Email visibility setting */
  visibility: string | null
}

/**
 * Result from getUserDetails containing user permissions and email.
 */
export interface UserDetails {
  /** The user's public email, if available */
  publicEmails: GitHubEmail | undefined
  /** List of permission names the user has based on team membership */
  permissions: string[]
}

const router = express.Router()

let options: AuthOptions | null = null

let endpoints: AuthEndpoints | null = null

/**
 * Creates middleware that uses Passport OAuth if configured, otherwise falls back to PAT.
 * If an OAuth token hasn't been configured, use a Personal Access Token instead.
 */
function passportOrPat(): RequestHandler {
  let passportAuth: RequestHandler | null = null
  function handler(request: Request, response: Response, next: NextFunction): void {
    if (options.clientId) {
      passportAuth = passportAuth || passport.authenticate('github', { session: false })
      passportAuth(request, response, next)
    } else {
      request.user = { githubAccessToken: options.token }
      next()
    }
  }
  return handler
}

router.get('/github', (req, res) => {
  // a shim to allow for a localhost UI to point to dev-api.
  // without this, /github/finalize won't be able to postMessage due to
  // cross-origin constraints. we're checking if the referrer (UI) is on
  // localhost, and if so, store the full origin (incl. port) in a cookie
  // to be read during /github/finalize.
  const referrer = req.get('Referrer')
  if (referrer) {
    try {
      const url = new URL(referrer)
      if (url.hostname === 'localhost') {
        res.cookie('localhostOrigin', url.origin)
      }
    } catch (err) {
      console.warn('Referrer parsing error, ignoring', err)
    }
  }

  res.redirect('github/start')
})

router.get('/github/start', passportOrPat(), (_req, res) => {
  // this only runs if passport didn't kick in above, but double
  // check for sanity in case upstream changes
  if (!options.clientId) {
    res.redirect('finalize')
  }
})

router.get('/github/finalize', passportOrPat(), async (req, res) => {
  const token = req.user.githubAccessToken
  const { publicEmails, permissions } = await getUserDetails(token, options.org)
  const username = req.user.username

  const result = JSON.stringify({ type: 'github-token', token, permissions, username, publicEmails })
  // allow for sending auth responses to localhost on dev site; see /github
  // route above. real origin is stored in cookie.
  let origin = endpoints.website
  if (endpoints.service.includes('dev-api') && req.cookies.localhostOrigin) {
    origin = req.cookies.localhostOrigin
  }

  // passing in the 'website' endpoint below is very important;
  // using '*' instead means this page will gladly send out a
  // user's token to any site that asks for it. see:
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  res.status(200).send(`<script>
      window.opener.postMessage(${result}, '${origin}');
      window.close();
    </script>`)
})

/**
 * Fetch user details including public emails and ClearlyDefined permissions
 * based on GitHub team membership in the identified org.
 */
async function getUserDetails(token: string, org: string): Promise<UserDetails> {
  const client = new Octokit({
    auth: token,
    headers: defaultHeaders
  })

  try {
    const emails = await client.users.listEmailsForAuthenticatedUser()
    const publicEmails = emails.data.find(email => email.visibility === 'public')
    const response = await client.teams.listForAuthenticatedUser()
    const permissions = response.data
      .filter(entry => entry.organization.login === org)
      .map(entry => entry.name)
      .map(findPermissions)
      .filter(e => e)

    return { publicEmails, permissions }
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
    return { publicEmails: undefined, permissions: [] }
  }
}

/**
 * Finds the permission name associated with a team.
 */
function findPermissions(team: string): string | null {
  const permissions = options.permissions
  for (const permission in permissions) {
    if (permissions[permission].includes(team)) {
      return permission
    }
  }
  return null
}

/**
 * Configures the auth module with options and endpoints.
 * Must be called before using the router.
 */
function setup(authOptions: AuthOptions, authEndpoints: AuthEndpoints): void {
  options = authOptions
  endpoints = authEndpoints
}

/**
 * Returns whether passport should be used for OAuth authentication.
 */
function usePassport(): boolean {
  return !!options.clientId
}

/**
 * Creates and returns the Passport GitHub strategy for OAuth.
 * Should only be called after setup() and if usePassport() returns true.
 */
function getStrategy(): GitHubStrategy {
  return new GitHubStrategy(
    {
      clientID: options.clientId,
      clientSecret: options.clientSecret,
      // this needs to match the callback url on the oauth app on github
      callbackURL: `${endpoints.service}/auth/github/finalize`,
      scope: ['public_repo', 'read:user', 'read:org', 'user:email']
    },
    (access, _refresh, profile, done) =>
      // this only lives for one request; see the 'finalize' endpoint
      done(null, { githubAccessToken: access, username: profile.username })
  )
}

export { getStrategy, router, setup, usePassport }
