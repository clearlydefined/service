// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('underscore');
const base64 = require('base-64');
const extend = require('extend');
const moment = require('moment');
const yaml = require('js-yaml');
const Github = require('../../lib/github');

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  constructor(options) {
    this.options = options;
  }

  addOrUpdate(packageCoordinates, patch) {
    if (!patch.patch)
      throw new Error('Cannot add or update an empty patch. Did you forget to put it in a "patch" property?');
    const github = Github.getClient(this.options);
    const { owner, repo, branch } = this.options;
    const path = this._getCurationPath(packageCoordinates);
    const prBranch = this._getBranchName(packageCoordinates);
    let curationPathSha = null;

    return this.get(packageCoordinates)
      .then(parsedContent => {
        // make patch independent of directory structure
        parsedContent = _.assign(parsedContent, {
          package: {
            type: packageCoordinates.type,
            provider: packageCoordinates.provider,
            name: packageCoordinates.name
          }
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
        parsedContent.revisions[packageCoordinates.revision] = _.assign(parsedContent.revisions[packageCoordinates.revision] || {}, patch.patch);

        // return the serialized YAML
        return yaml.safeDump(parsedContent, { sortKeys: true });
      })
      .then(updatedPatch => {
        return github.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
          .then(masterBranch => {
            const sha = masterBranch.data.commit.sha;
            return github.gitdata.createReference({ owner, repo, ref: `refs/heads/${prBranch}`, sha });
          })
          .then(ref => {
            return updatedPatch;
          });
      })
      .then(updatedPatch => {
        const message = `Update ${path} ${packageCoordinates.revision}`;
        if (curationPathSha)
          return github.repos.updateFile({
            owner,
            repo,
            path,
            message,
            content: base64.encode(updatedPatch),
            branch: prBranch,
            sha: curationPathSha
          });
        return github.repos.createFile({
          owner,
          repo,
          path,
          message,
          content: base64.encode(updatedPatch),
          branch: prBranch
        });
      })
      .then(destination => {
        return github.pullRequests.create({
          owner,
          repo,
          title: this._getPrTitle(packageCoordinates),
          body: patch.description,
          head: `refs/heads/${prBranch}`,
          base: branch
        });
      });
  }

  async get(packageCoordinates, pr = null) {
    const curationPath = this._getCurationPath(packageCoordinates);
    const { owner, repo } = this.options;
    const branch = await this.getBranch(pr);

    const github = Github.getClient(this.options);
    try {
      const contentResponse = await github.repos.getContent({ owner, repo, ref: branch, path: curationPath });
      const content = yaml.safeLoad(base64.decode(contentResponse.data.content));
      // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
      Object.defineProperty(content, 'origin', { value: { sha: contentResponse.data.sha }, enumerable: false });
      return content;
    }
    catch (error) {
      // TODO: This isn't very safe how it is because any failure will return an empty object,
      // ideally we only do this if the .yaml file doesn't exist.
      return { revisions: {} };
    }
  }

  async getBranch(number) {
    if (!number)
      return this.options.branch;
    const { owner, repo } = this.options;
    const github = Github.getClient(this.options);
    const result = await github.pullRequests.get({ owner, repo, number });
    return result.data.head.ref;
  }

  async curate(packageCoordinates, pr, summarized) {
    const curation = await this.get(packageCoordinates, pr)
    const revision = curation ? curation.revisions[packageCoordinates.revision] : null;
    return revision ? extend(true, {}, summarized, revision) : summarized;
  }

  _getPrTitle(packageCoordinates) {
    return `${packageCoordinates.type.toLowerCase()}/${packageCoordinates.provider.toLowerCase()}/${packageCoordinates.name}/${packageCoordinates.revision}`;
  }

  _getBranchName(packageCoordinates) {
    return `${packageCoordinates.type.toLowerCase()}_${packageCoordinates.name}_${packageCoordinates.revision}_${moment().format('YYMMDD_HHmmss.SSS')}`;
  }

  _getCurationPath(packageCoordinates) {
    return `curations/${packageCoordinates.type.toLowerCase()}/${packageCoordinates.provider.toLowerCase()}/${packageCoordinates.name}.yaml`;
  }
}

module.exports = (options) => new GitHubCurationService(options);