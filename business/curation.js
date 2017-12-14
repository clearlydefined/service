// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const _ = require('underscore');
const base64 = require('base-64');
const yaml = require('js-yaml');

const Github = require('../lib/github');

// Responsible for managing curation patches in a store
class CurationService {
  constructor(options) {
    this.options = options;
  }

  addOrUpdate(requestId, type, provider, packageName, packageRevision, curationPatch) {
    const github = Github.getClient(this.options.config.store.github);
    const owner = this.options.config.store.github.owner;
    const repo = this.options.config.store.github.repo;
    const branch = this.options.config.store.github.branch;
    const curationPath = this._getCurationPath(type, provider, packageName, packageRevision);
    let curationPathSha = null;

    return this.get(type, provider, packageName, packageRevision)
      .then(parsedContent => {
        // make patch independent of directory structure
        parsedContent = _.assign(parsedContent, {
          type: type,
          provider: provider,
          name: packageName
        });

        // remove and re-add the revisions property so it appears after the metadata properties (and default it to empty)
        const revisions = parsedContent.revisions;
        delete parsedContent.revisions;
        parsedContent.revisions = revisions || {};

        // extract the file's SHA1 to enable updating the file
        if (parsedContent.origin) {
          curationPathSha = parsedContent.origin.sha;
        }

        // add/update the patch for this revision
        parsedContent.revisions[packageRevision] = _.assign(parsedContent.revisions[packageRevision] || {}, curationPatch);

        // return the serialized YAML
        const updatedPatch = yaml.safeDump(parsedContent);
        return updatedPatch;
      })
      .then(updatedPatch => {
        return github.repos.getBranch({
          owner: owner,
          repo: repo,
          branch: `refs/heads/${branch}`
        }).then(masterBranch => {
          return github.gitdata.createReference({
            owner: owner,
            repo: repo,
            ref: `refs/heads/${requestId}`,
            sha: masterBranch.data.commit.sha
          })
        })
          .then(ref => {
            return [ref, updatedPatch];
          });
      })
      .then(destination => {
        if (curationPathSha) {
          return github.repos.updateFile({
            owner: owner,
            repo: repo,
            path: curationPath,
            message: requestId,
            content: base64.encode(destination[1]),
            branch: requestId,
            sha: curationPathSha
          });
        } else {
          return github.repos.createFile({
            owner: owner,
            repo: repo,
            path: curationPath,
            message: requestId,
            content: base64.encode(destination[1]),
            branch: requestId
          });
        }
        return destination;
      })
      .then(destination => {
        return github.pullRequests.create({
          owner: owner,
          repo: repo,
          title: `${type.toLowerCase()}/${provider.toLowerCase()}/${packageName}/${packageRevision}`,
          head: `refs/heads/${requestId}`,
          base: branch
        })
      });
  }

  get(type, provider, packageName, packageRevision) {
    const curationPath = this._getCurationPath(type, provider, packageName, packageRevision);
    const owner = this.options.config.store.github.owner;
    const repo = this.options.config.store.github.repo;
    const branch = this.options.config.store.github.branch;

    const github = Github.getClient(this.options.config.store.github);
    return github.repos.getContent({
      owner: owner,
      repo: repo,
      branch: branch,
      path: curationPath
    })
      .then(contentResponse => {
        const content = yaml.safeLoad(base64.decode(contentResponse.data.content));
        content.origin = {
          sha: contentResponse.data.sha
        };
        Object.defineProperty(content, 'origin', {
          enumerable: false
        });
        return content;
      })
      .catch(err => {
        // TODO: This isn't very safe how it is because any failure will return an empty object,
        // ideally we only do this if the .yaml file doesn't exist.
        return {};
      })
  }

  _getCurationPath(type, provider, packageName) {
    return `curations/${type.toLowerCase()}/${provider.toLowerCase()}/${packageName}.yaml`;
  }
}

module.exports = {
  CurationService: CurationService
};
