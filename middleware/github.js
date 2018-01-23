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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).end();
    return;
  }
  const token = authHeader.split(' ')[1];

  // constructor and authenticate are inexpensive (just sets local state)
  const client = new GitHubApi(options);
  client.authenticate({
    type: 'token',
    token,
  });
  req.app.locals.user = {
    github: {
      client,
    }
  };

  // check cache for team data; hash the token so we're not storing them raw
  const hashedToken = await crypto.createHash('sha256').update(token).digest('hex');
  const teamCacheKey = `github.teams.${hashedToken}`;
  let teams = await req.app.locals.cache.get(teamCacheKey);

  // and fetch it otherwise
  if (!teams) {
    try {
      // TEMPORARY: remove once team permissions are decided on
      await orgCheckShim(client);

    } catch (err) {
      res.status(401).send({error: err});
      return;
    }

    // TEMPORARY: ideally we'd not use this, but PATs as-configured
    // don't get access to teams. someday switch everyone to personal
    // oauth apps?
    try {
      teams = await getTeams(client, config.auth.github.org);
    } catch (err) {
      teams = [];
    }

    await req.app.locals.cache.set(teamCacheKey, teams, config.auth.github.timeouts.team);
  }

  req.app.locals.user.github.teams = teams;
  next();
});

// TEMPORARY: for now, just verify org membership for website access
async function orgCheckShim(client) {
  // except when not using oauth for dev
  if (!config.auth.github.clientId) {
    return;
  }

  const orgResp = await client.users.getOrgMembership({
    org: config.auth.github.org,
  });
  if (orgResp.data.state !== 'active') {
    throw new Error('membership not active');
  }
}

/**
 * Fetch a list of teams a user belogs to filtered for the given org.
 * @param {object} client - GitHubApi client
 * @param {string} org - org name to filter teams
 * @returns {Promise<Array<string>>} - list of teams
 */
async function getTeams(client, org) {
  const resp = await client.users.getTeams();
  return resp.data
    .filter(entry => entry.organization.login === org)
    .map(entry => entry.name);
}