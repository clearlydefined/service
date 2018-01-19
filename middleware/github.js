// SPDX-License-Identifier: MIT

const GitHubApi = require('@octokit/rest');

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
module.exports = (req, res, next) => {
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
  req.user = {
    github: {
      client,
    }
  };

  (async () => {
    // check cache for team data
    const teamCacheKey = `github.teams.${token}`;
    let teams = await req.app.locals.cache.get(teamCacheKey);

    // and fetch it otherwise
    if (!teams) {
      teams = await getTeams(client, req.app.locals.config.auth.github.org);
      await req.app.locals.cache.set(teamCacheKey, teams, 10);
    }

    req.user.github.teams = teams;
  })().then(() => next()).catch(next);
};

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