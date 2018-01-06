// Copyright (c) 2017, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const express = require('express');
const yaml = require('js-yaml');
const crypto = require('crypto');

const router = express.Router();
const validPrActions = ['opened', 'reopened', 'synchronize'];
let webhookSecret = null;
let logger = null;
let curationService;

router.post('/', async (request, response, next) => {
  const isGithubEvent = request.headers['x-github-event'];
  const signature = request.headers['x-hub-signature'];
  if (!isGithubEvent || !signature)
    return fatal(request, response, 'Missing signature or event type on GitHub webhook');

  const computedSignature = 'sha1=' + crypto.createHmac('sha1', webhookSecret).update(request.body).digest('hex');
  if (!crypto.timingSafeEqual(new Buffer(signature), new Buffer(computedSignature))) {
    return fatal(request, response, 'X-Hub-Signature does not match blob signature');
  }

  const { pull_request: pr, action: prAction, number } = JSON.parse(request.body);
  const { sha, ref } = pr.head;
  const isValidPullRequest = pr && validPrActions.includes(prAction);
  if (!isValidPullRequest)
    return fatal(request, response, 'Not a valid Pull Request event');

  await curationService.postCommitStatus(sha, pr, 'pending', 'Validation in progress');
  const prFiles = await curationService.getPrFiles(number);
  const curationFilenames = prFiles
    .map(x => x.filename)
    .filter(curationService.isCurationFile);

  const curationResults = await Promise.all(
    curationFilenames.map(path => curationService
      .getContent(ref, path)
      .then(curationService.isValidCuration))
  );
  const invalidCurations = [];
  curationResults.forEach((result, index) => {
    if (!result)
      invalidCurations.push(curationFilenames[index]);
  });

  let state = 'success';
  let description = 'All curations are valid'
  if (invalidCurations.length) {
    state = 'error';
    description = `Invalid curations: ${invalidCurations.join(', ')}`
  }

  await curationService.postCommitStatus(sha, pr, state, description);
  response.status(200).end();
});

function fatal(request, response, error) {
  getLogger().error(error);
  response.status(500);
  response.setHeader('content-type', 'text/plain');
  response.end(JSON.stringify(error));
}

function getLogger() {
  return logger;
}

// @todo add secret
function setup(service, appLogger, secret) {
  curationService = service;
  webhookSecret = secret;
  logger = appLogger
  return router;
}

module.exports = setup;
