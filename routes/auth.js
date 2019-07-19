// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const passport = require('passport')
const GitHubStrategy = require('passport-github').Strategy
const { URL } = require('url')
const GitHubApi = require('@octokit/rest')

const router = express.Router()
let options = null
let endpoints = null

/**
 * If an OAuth token hasn't been configured, use a Personal Access Token
 * instead.
 */
function passportOrPat() {
  let passportAuth = null
  return (request, response, next) => {
    if (options.clientId) {
      passportAuth = passportAuth || passport.authenticate('github', { session: false })
      return passportAuth(request, response, next)
    }
    request.user = { githubAccessToken: options.token }
    next()
  }
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
      if (url.hostname === 'localhost') res.cookie('localhostOrigin', url.origin)
    } catch (err) {
      console.warn('Referrer parsing error, ignoring', err)
    }
  }

  res.redirect('github/start')
})

router.get('/github/start', passportOrPat(), (req, res) => {
  // this only runs if passport didn't kick in above, but double
  // check for sanity in case upstream changes
  if (!options.clientId) res.redirect('finalize')
})

router.get('/github/finalize', passportOrPat(), async (req, res) => {
  const token = req.user.githubAccessToken
  const { publicEmails, permissions } = await getUserDetails(token, options.org)
  const username = req.user.username

  const result = JSON.stringify({ type: 'github-token', token, permissions, username, publicEmails })
  // allow for sending auth responses to localhost on dev site; see /github
  // route above. real origin is stored in cookie.
  let origin = endpoints.website
  if (endpoints.service.includes('dev-api') && req.cookies.localhostOrigin) origin = req.cookies.localhostOrigin

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
 * Fetch a list of ClearlyDefined permissions related to the given token in the identified org.
 * @param {string} token - GitHubApi token
 * @param {string} org - org name to filter teams
 * @returns {Promise<Array<string>>} - list of permission names
 */
async function getUserDetails(token, org) {
  const options = { headers: { 'user-agent': 'clearlydefined.io' } }
  const client = new GitHubApi(options)
  token && client.authenticate({ type: 'token', token })

  try {
    const emails = await client.users.getEmails()
    const publicEmails = emails.data.find(email => email.visibility === 'public')
    const response = await client.users.getTeams()
    const permissions = response.data
      .filter(entry => entry.organization.login === org)
      .map(entry => entry.name)
      .map(findPermissions)
      .filter(e => e)

    return { publicEmails, permissions }
  } catch (error) {
    if (error.code === 404)
      console.error(
        'GitHub returned a 404 when trying to read team data. ' +
          'You probably need to re-configure your CURATION_GITHUB_TOKEN token with the `read:org` scope. (This only affects local development.)'
      )
    else if (error.code === 401 && error.message === 'Bad credentials')
      // the token was bad. trickle up the problem so the user can fix
      throw error
    // XXX: Better logging situation?
    else console.error(error)
    // in all other error cases assume the user has no teams. If they do then they can try again after the timeout
    return []
  }
}

function findPermissions(team) {
  const permissions = options.permissions
  for (const permission in permissions) if (permissions[permission].includes(team)) return permission
  return null
}

function setup(authOptions, authEndpoints) {
  options = authOptions
  endpoints = authEndpoints
}

function usePassport() {
  return !!options.clientId
}

function getStrategy() {
  return new GitHubStrategy(
    {
      clientID: options.clientId,
      clientSecret: options.clientSecret,
      // this needs to match the callback url on the oauth app on github
      callbackURL: `${endpoints.service}/auth/github/finalize`,
      scope: ['public_repo', 'read:user', 'read:org', 'user', 'user:email']
    },
    (access, refresh, profile, done) =>
      // this only lives for one request; see the 'finalize' endpoint
      done(null, { githubAccessToken: access, username: profile.username })
  )
}

module.exports = { setup, router, usePassport, getStrategy }
