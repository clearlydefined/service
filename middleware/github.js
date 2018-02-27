// Copyright 2018 Amazon.com, Inc. or its affiliates.
// SPDX-License-Identifier: MIT

const crypto = require('crypto');
const GitHubApi = require('@octokit/rest');

const asyncMiddleware = require('./asyncMiddleware');
const config = require('../lib/config');

const options = {
  headers: {
    'user-agent': 'clearlydefined.io',
  },
};

/**
 * GitHub convenience middleware that injects a client into the request object
 * that is pre-configured for the current user. Also injects a cached copy
 * of relevant teams the user is a member of.
 */
module.exports = asyncMiddleware(async (req, res, next) => {
  const authHeader = req.get('authorization');
  // if there is an auth header, it had better be Bearer
  if (authHeader && !authHeader.startsWith('Bearer ')) {
    res.status(401).end();
    return;
  }

  const token = authHeader ? authHeader.split(' ')[1] : null;
  const client = setupClient(req, token);
  await setupTeams(req, token, client);
  next();
});

// Create and configure a GitHub client and attach it to the request
function setupClient(req, token = null) {
  // constructor and authenticate are inexpensive (just sets local state)
  const client = new GitHubApi(options);
  token && client.authenticate({ type: 'token', token });
  req.app.locals.user = { github: { client } };
  return client;
}

// get the user's teams (from GitHub or the cache) and attach them to the request
async function setupTeams(req, token, client = null) {
  // anonymous users are not members of any team
  if (!token)
    return req.app.locals.user.github.teams = [];

  // check cache for team data; hash the token so we're not storing them raw
  const hashedToken = await crypto.createHash('sha256').update(token).digest('hex');
  const teamCacheKey = `github.teams.${hashedToken}`;
  let teams = await req.app.locals.cache.get(teamCacheKey);
  if (!teams) {
    teams = await getTeams(client, config.auth.github.org);
    await req.app.locals.cache.set(teamCacheKey, teams, config.auth.github.timeouts.team);
  }
  req.app.locals.user.github.teams = teams;
}

/**
 * Fetch a list of teams a user belogs to filtered for the given org.
 * @param {object} client - GitHubApi client
 * @param {string} org - org name to filter teams
 * @returns {Promise<Array<string>>} - list of teams
 */
async function getTeams(client, org) {
  try {
    const resp = await client.users.getTeams();
    return resp.data
      .filter(entry => entry.organization.login === org)
      .map(entry => entry.name);
  } catch (err) {
    if (err.code === 404) {
      console.error('GitHub returned a 404 when trying to read team data. ' +
        'You probably need to re-configure your CURATION_GITHUB_TOKEN token with the `read:org` scope. (This only affects local development.)');
    } else if (err.code === 401 && err.message === 'Bad credentials') {
      // the token was bad. trickle up the problem so the user can fix 
      throw err;
    } else {
      // XXX: Better logging situation?
      console.error(err);
    }
    // in all other error cases assume the user has no teams. If they do then they can try again after the timeout
    return [];
  }
}
