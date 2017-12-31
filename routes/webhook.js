// Copyright (c) 2017, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const express = require('express');

const router = express.Router();
let webhookSecret = null;
const validPrActions = ['opened', 'reopened', 'synchronize'];

router.post('/', async (request, response, next) => {
  const isGithubEvent = request.headers['x-github-event'];
  if (!isGithubEvent) {
    return fatal(request, response, 'Not a Github event');
  }

  // @todo secure webhook, see https://github.com/Microsoft/ghcrawler/blob/develop/routes/webhook.js#L28

  const {body: payload} = request;
  const isValidPullRequest = payload.pull_request && validPrActions.includes(payload.action);
  if (!isValidPullRequest) {
    return fatal(request, response, 'Not a valid Pull Request event');
  }

  // @todo get changed files

  // @todo validate yaml files

  logger().info(payload);

  response.status(200).end();
});

function fatal(request, response, error) {
  logger().error(error);
  response.status(500);
  response.setHeader('content-type', 'text/plain');
  response.end(JSON.stringify(error));
}

// @todo add real logger
function logger() {
  return console;
}

// @todo add secret
function setup(secret) {
  webhookSecret = secret;
  return router;
}

module.exports = setup;
