// SPDX-License-Identifier: MIT

const express = require('express');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;

const config = require('../lib/config');
const utils = require('../lib/utils');
const asyncMiddleware = require('../middleware/asyncMiddleware');

const router = express.Router();

router.get('/github',
  passport.authenticate('github', { session: false })
);

router.get('/github/finalize',
  passport.authenticate('github', { session: false }),
  (req, res) => {
    const safeToken = encodeURIComponent(req.user.githubAccessToken);

    // passing in the 'website' endpoint below is very important;
    // using '*' instead means this page will gladly send out a
    // user's token to any site that asks for it. see:
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
    res.status(200).send(`<script>
      window.opener.postMessage({
        type: 'github-token',
        token: '${safeToken}',
      }, '${config.endpoints.website}');
      window.close();
    </script>`);
  }
);

function setup() {
  return router;
}

setup.getStrategy = () => {
  return new GitHubStrategy({
    clientID: config.auth.github.clientId,
    clientSecret: config.auth.github.clientSecret,
    // this needs to match the callback url on the oauth app on github
    callbackURL: `${config.endpoints.service}/auth/github/finalize`,
    scope: ['repo', 'user']
  },
  function (access, refresh, profile, done) {
    // this only lives for one request; see the 'finalize' endpoint
    done(null, { githubAccessToken: access });
  });
};

module.exports = setup;