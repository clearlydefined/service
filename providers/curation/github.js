// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('underscore');
const base64 = require('base-64');
const extend = require('extend');
const moment = require('moment');
const yaml = require('js-yaml');
const Github = require('../../lib/github');
const utils = require('../../lib/utils')

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

    return this.getAll(packageCoordinates)
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

  /**
   * Get the curation for the entity at the given coordinates. If no curation is supplied
   * then look up the standard curation. If the curation is a PR number, get the curation
   * held in that PR. The curation arg might be the actual curation to use. If so, just
   * return it.
   * 
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation. Must include revision.
   * @param {(number | string | Summary)} [curation] - The curation identifier if any. Could be a PR number, 
   * an actual curation object or null.
   * @returns {Summary} The requested curation
   */
  async get(coordinates, curation = null) {
    if (!coordinates.revision)
      throw new Error('Coordinates must include a revision');
    if (curation && typeof curation !== 'number' && typeof curation !== 'string')
      return curation;
    const all = await this.getAll(coordinates, curation);
    return all && all.revisions ? all.revisions[coordinates.revision] : null;
  }

  /**
   * Get the curations for the revisions of the entity at the given coordinates. Revision information
   * in coordinates are ignored. If a PR number is provided, get the curations represented in that PR.
   * 
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation. 
   * @param {(number | string} [curation] - The curation identifier if any. Could be a PR number/string.
   * @returns {Object} The requested curations where the revisions property has a property for each 
   * curated revision.
   */
  async getAll(packageCoordinates, pr = null) {
    const curationPath = this._getCurationPath(packageCoordinates);
    const { owner, repo } = this.options;
    const branch = await this.getBranch(pr);

    const github = Github.getClient(this.options);
    try {
      // @todo use getContent() to get raw content
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

  async curate(packageCoordinates, curationSpec, summarized) {
    const curation = await this.get(packageCoordinates, curationSpec)
    return curation ? extend(true, {}, summarized, curation) : summarized;
  }

  async getContent(ref, path) {
    const { owner, repo } = this.options;
    const github = Github.getClient(this.options);
    try {
      const response = await github.repos.getContent({ owner, repo, ref, path });
      return base64.decode(response.data.content);
    } catch (error) {
      // @todo add logger
    }
  }

  async postCommitStatus(sha, pr, state, description) {
    const { owner, repo } = this.options;
    const github = Github.getClient(this.options);
    // TODO hack alert! use the title of the PR to find the component in clearlydefined.io
    // In the future we need a more concrete/robust way to capture this in the PR in the face of 
    // people not using out tools etc. Ideally read it out of the PR files themselves. 
    const target_url = `https://dev.clearlydefined.io/curation/${pr.title}/pr/${pr.number}`;
    try {
      return github.repos.createStatus({
        owner, repo, sha, state, description, target_url, context: 'ClearlyDefined'
      });
    } catch (error) {
      // @todo add logger
    }
  }

  async getPrFiles(number) {
    const { owner, repo } = this.options;
    const github = Github.getClient(this.options);
    try {
      const response = await github.pullRequests.getFiles({ owner, repo, number });
      return response.data;
    } catch (error) {
      // @todo add logger
      throw error;
    }
  }

  _getPrTitle(packageCoordinates) {
    const c = packageCoordinates;
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return `${c.type.toLowerCase()}/${c.provider.toLowerCase()}/${c.namespace || '-'}/${c.name}/${c.revision}`;
  }

  _getBranchName(packageCoordinates) {
    return `${packageCoordinates.type.toLowerCase()}_${packageCoordinates.name}_${packageCoordinates.revision}_${moment().format('YYMMDD_HHmmss.SSS')}`;
  }

  _getCurationPath(packageCoordinates) {
    return `curations/${packageCoordinates.type.toLowerCase()}/${packageCoordinates.provider.toLowerCase()}/${packageCoordinates.name}.yaml`;
  }

  // @todo improve validation via schema, etc
  // return the loaded curation if possible
  isValidCuration(curation) {
    try {
      return yaml.safeLoad(curation);
    } catch (error) {
      return null;
    }
  }

  // @todo perhaps validate directory structure (package coordinates)
  isCurationFile(path) {
    return path.startsWith('curations/') && path.endsWith('.yaml');
  }
}

module.exports = (options) => new GitHubCurationService(options);
