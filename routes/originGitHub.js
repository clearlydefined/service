// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware');
const router = require('express').Router();
const Github = require('../lib/github');

function getClient(request) {
  // return request.user.github.client;
  // TODO reaching in and using the curation token for right now. When the GitHub Auth work is done
  // delete the code below and uncomment the line above.
  const token = request.app.locals.config.curation.store.github.token;
  return Github.getClient({ token });
}

router.get('/:login/:repo/revisions', asyncMiddleware(async (request, response) => {
  try {
    const { login, repo } = request.params;
    const github = getClient(request);
    const answer = await github.gitdata.getTags({ owner: login, repo, per_page: 100 });
    const result = answer.data.map(item => {
      return { tag: item.ref.slice(10), sha: item.object.sha }
    });
    return response.status(200).send(result);
  } catch (error) {
    if (error.code === 404)
      return response.status(200).send([]);
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
    return response.status(200).send([]);
  }
}));

router.get('/:login/:repo?', asyncMiddleware(async (request, response) => {
  const { login, repo } = request.params;
  const github = getClient(request);
  if (request.path.indexOf('/', 1) > 0) {
    const answer = await github.search.repos({ q: `${repo || ''}+user:${login}+in:name+fork:true`, sort: 'stars', per_page: 100 });
    const result = answer.data.items.map(item => { return { id: item.full_name } });
    return response.status(200).send(result);
  }
  const answer = await github.search.users({ q: `${login}+repos:>0`, sort: 'repositories', per_page: 30 })
  const result = answer.data.items.map(item => { return { id: item.login } });
  return response.status(200).send(result);
}));

function setup() {
  return router;
}

module.exports = setup;
