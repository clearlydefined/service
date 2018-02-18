// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const _ = require('underscore');
const base64 = require('base-64');
const extend = require('extend');
const { exec } = require('child_process');
const fs = require('fs');
const moment = require('moment');
const readdirp = require('readdirp');
const yaml = require('js-yaml');
const Github = require('../../lib/github');
const tmp = require('tmp');
tmp.setGracefulCleanup();

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  constructor(options) {
    this.options = options;
    this.curationUpdateTime = null;
    this.tempLocation = tmp.dirSync(this.tmpOptions);
  }

  get tmpOptions() {
    return {
      unsafeCleanup: true,
      template: `${this.options.tempLocation}/cd-XXXXXX`
    };
  }

  addOrUpdate(githubUserClient, coordinates, patch) {
    if (!patch.patch)
      throw new Error('Cannot add or update an empty patch. Did you forget to put it in a "patch" property?');
    const github = githubUserClient;
    const { owner, repo, branch } = this.options;
    const path = this._getCurationPath(coordinates);
    const prBranch = this._getBranchName(coordinates);
    let curationPathSha = null;

    return this.getAll(coordinates)
      .then(parsedContent => {
        // make patch independent of directory structure
        parsedContent = _.assign(parsedContent, {
          package: {
            type: coordinates.type,
            provider: coordinates.provider,
            namespace: coordinates.namespace === '-' ? null : coordinates.namespace,
            name: coordinates.name
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
        parsedContent.revisions[coordinates.revision] = _.assign(parsedContent.revisions[coordinates.revision] || {}, patch.patch);

        // return the serialized YAML
        return yaml.safeDump(parsedContent, { sortKeys: true });
      })
      .then(updatedPatch => {
        return github.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
          .then(masterBranch => {
            const sha = masterBranch.data.commit.sha;
            return github.gitdata.createReference({ owner, repo, ref: `refs/heads/${prBranch}`, sha });
          })
          .then(() => updatedPatch);
      })
      .then(updatedPatch => {
        const message = `Update ${path} ${coordinates.revision}`;
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
      .then(() => {
        return github.pullRequests.create({
          owner,
          repo,
          title: this._getPrTitle(coordinates),
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
   * @returns {Object} The requested curation and corresponding revision identifier (e.g., commit sha) if relevant
   */
  async get(coordinates, curation = null) {
    if (!coordinates.revision)
      throw new Error('Coordinates must include a revision');
    if (curation && typeof curation !== 'number' && typeof curation !== 'string')
      return curation;
    const all = await this.getAll(coordinates, curation);
    if (!all || !all.revisions)
      return null;
    const result = all.revisions[coordinates.revision];
      // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
      Object.defineProperty(result, '_origin', { value: { sha: all._origin }, enumerable: false });
    return result;
  }

  /**
   * Get the curations for the revisions of the entity at the given coordinates. Revision information
   * in coordinates are ignored. If a PR number is provided, get the curations represented in that PR.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation.
   * @param {(number | string} [pr] - The curation identifier if any. Could be a PR number/string.
   * @returns {Object} The requested curations where the revisions property has a property for each
   * curated revision. The returned value will be decorated with a non-enumerable `_origin` property 
   * indicating the sha of the commit for the curations if that info is available.
   */
  async getAll(coordinates, pr = null) {
    const curationPath = this._getCurationPath(coordinates);
    const { owner, repo } = this.options;
    const branch = await this.getBranch(pr);

    const github = Github.getClient(this.options);
    try {
      // @todo use getContent() to get raw content
      const contentResponse = await github.repos.getContent({ owner, repo, ref: branch, path: curationPath });
      const content = yaml.safeLoad(base64.decode(contentResponse.data.content));
      // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
      Object.defineProperty(content, '_origin', { value: { sha: contentResponse.data.sha }, enumerable: false });
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

  async apply(packageCoordinates, curationSpec, summarized) {
    const curation = await this.get(packageCoordinates, curationSpec);
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
    // TODO hack alert! use the title of the PR to find the definition in clearlydefined.io
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

  /**
   * Given a partial spec, return the list of full spec urls for each curated version of the spec'd components
   * @param {EntityCoordinates} coordinates - the partial coordinates that describe the sort of curation to look for.
   * @returns {[URL]} - Array of URLs describing the available curations
   */
  async list(coordinates) {
    await this.ensureCurations();
    const root = `${this.tempLocation.name}/${this.options.repo}/${this._getSearchRoot(coordinates)}`;
    if (!fs.existsSync(root))
      return [];
    return new Promise((resolve, reject) => {
      const result = [];
      readdirp({ root, fileFilter: '*.yaml' })
        .on('data', entry => result.push(...this.handleEntry(entry)))
        .on('end', () => resolve(result))
        .on('error', reject);
    });
  }

  handleEntry(entry) {
    const curation = yaml.safeLoad(fs.readFileSync(entry.fullPath.replace(/\\/g, '/')));
    const { package: p, revisions } = curation;
    const root = `${p.type}/${p.provider}/${p.namespace || '-'}/${p.name}/`;
    return Object.getOwnPropertyNames(revisions).map(version => root + version);
  }

  async ensureCurations() {
    if (this.curationUpdateTime && (Date.now - this.curationUpdateTime < this.options.curationFreshness))
      return;
    const { owner, repo } = this.options;
    const url = `https://github.com/${owner}/${repo}.git`;
    const command = this.curationUpdateTime
      ? `cd ${this.tempLocation.name}/${repo} && git pull`
      : `cd ${this.tempLocation.name} && git clone ${url}`;
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error)
          return reject(error);
        this.curationUpdateTime = Date.now;
        resolve(stdout);
      });
    });
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

  _getPrTitle(coordinates) {
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return coordinates.toString();
  }

  _getBranchName(coordinates) {
    const c = coordinates;
    return `${c.type.toLowerCase()}_${c.name}_${c.revision}_${moment().format('YYMMDD_HHmmss.SSS')}`;
  }

  _getCurationPath(coordinates) {
    const path = coordinates.asRevisionless().toString();
    return `curations/${path}.yaml`;
  }

  _getSearchRoot(coordinates) {
    const path = coordinates.asRevisionless().toString();
    return `curations/${path ? path + '/' : ''}`;
  }

  // @todo perhaps validate directory structure (package coordinates)
  isCurationFile(path) {
    return path.startsWith('curations/') && path.endsWith('.yaml');
  }
}

module.exports = (options) => new GitHubCurationService(options);
