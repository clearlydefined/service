// Copyright (c) 2017, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const validPrActions = ['opened', 'reopened', 'synchronize', 'closed'];
let webhookSecret = null;
let logger = null;
let curationService;
let test = false;

router.post('/', handlePost);
async function handlePost (request, response) {
  const body = validateHookCall(request, response);
  if (!body)
    return;
  const pr = body.pull_request;
  if (body.action === 'closed')
    pr.merged ? await curationService.handleMerge(pr.number, pr.head.ref) : null;
  else {
    // TODO hack alert! use the title of the PR to find the definition in clearlydefined.io
    // In the future we need a more concrete/robust way to capture this in the PR in the face of
    // people not using out tools etc. Ideally read it out of the PR files themselves.
    await curationService.validateCurations(pr.number, pr.title, pr.head.sha, pr.head.ref);
  }
  response.status(200).end();
}

function validateHookCall(request, response) {
  const isGithubEvent = request.headers['x-github-event'];
  const signature = request.headers['x-hub-signature'];
  if (!isGithubEvent || !signature)
    return fatal(request, response, 400, 'Missing signature or event type on GitHub webhook');

  const computedSignature = 'sha1=' + crypto.createHmac('sha1', webhookSecret).update(request.body).digest('hex');
  if (!test && !crypto.timingSafeEqual(new Buffer(signature), new Buffer(computedSignature))) 
    return fatal(request, response, 400, 'X-Hub-Signature does not match blob signature');

  const body = JSON.parse(request.body);
  const isValidPullRequest = body.pull_request && validPrActions.includes(body.action);
  if (!isValidPullRequest)
    return fatal(request, response, 200);  
  return body;
}

function fatal(request, response, code, error = null) {
  logger.error(error);
  response.status(code);
  response.setHeader('content-type', 'text/plain');
  response.end(error);
  return false;
}

function setup(service, appLogger, secret, testFlag = false) {
  curationService = service;
  webhookSecret = secret;
  logger = appLogger;
  test = testFlag;
  if (test) {
    router._handlePost = handlePost;
    router._validateHookCall = validateHookCall;
  }
  return router;
}

module.exports = setup;
