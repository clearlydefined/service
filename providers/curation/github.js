// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { assign, concat, get, forIn, merge, set } = require('lodash')
const base64 = require('base-64')
const extend = require('extend')
const { exec } = require('child_process')
const fs = require('fs')
const moment = require('moment')
const readdirp = require('readdirp')
const yaml = require('js-yaml')
const throat = require('throat')
const Github = require('../../lib/github')
const Curation = require('../../lib/curation')
const EntityCoordinates = require('../../lib/entityCoordinates')
const tmp = require('tmp')
const path = require('path')
tmp.setGracefulCleanup()

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  constructor(options, endpoints, definitionService) {
    this.options = options
    this.endpoints = endpoints
    this.curationUpdateTime = null
    this.tempLocation = null
    this.definitionService = definitionService
  }

  get tmpOptions() {
    return {
      unsafeCleanup: true,
      template: `${this.options.tempLocation}/cd-XXXXXX`
    }
  }

  _updateContent(coordinates, currentContent, newContent) {
    const result = {
      coordinates: {
        type: coordinates.type,
        provider: coordinates.provider,
        namespace: coordinates.namespace === '-' ? null : coordinates.namespace,
        name: coordinates.name
      }
    }
    result.revisions = assign(get(currentContent, 'revisions') || {})
    forIn(newContent, function (value, key) {
      result.revisions[key] = merge(result.revisions[key] || {}, value)
    })
    return yaml.safeDump(result, { sortKeys: true })
  }


  async _writePatch(userGithub, serviceGithub, description, patch, branch) {
    const { owner, repo } = this.options
    const coordinates = new EntityCoordinates(patch.coordinates.type, patch.coordinates.provider, patch.coordinates.namespace, patch.coordinates.name)
    const currentContent = await this.getAll(coordinates)
    const newContent = patch.revisions
    const updatedContent = this._updateContent(coordinates, currentContent, newContent)
    const content = base64.encode(updatedContent)
    const path = this._getCurationPath(coordinates)
    const message = `Update ${path}`
    const committer = userGithub ? await userGithub.users.get({}) : await serviceGithub.users.get({})
    if (currentContent && currentContent._origin)
      return serviceGithub.repos.updateFile({
        owner,
        repo,
        path,
        message,
        content,
        branch,
        sha: currentContent._origin.sha,
        committer: `{ "name": "${committer.data.name}", "email": "${committer.data.email}" }`,
      })
    return serviceGithub.repos.createFile({
      owner,
      repo,
      path,
      message,
      content,
      branch,
      committer: `{ "name": "${committer.data.name}", "email": "${committer.data.email}" }`,
    })
  }

  async addOrUpdate(userGithub, serviceGithub, patch) {
    const { owner, repo, branch } = this.options
    const master = await serviceGithub.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
    const sha = master.data.commit.sha
    const prBranch = await this._getBranchName(userGithub, serviceGithub)
    await serviceGithub.gitdata.createReference({ owner, repo, ref: `refs/heads/${prBranch}`, sha })
    await Promise.all(patch.patches.map(throat(1, component => this._writePatch(userGithub, serviceGithub, patch.description, component, prBranch))))
    // Create the PR using service github object
    return serviceGithub.pullRequests.create({
      owner,
      repo,
      title: prBranch,
      body: patch.description,
      head: `refs/heads/${prBranch}`,
      base: branch
    })

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
    if (!coordinates.revision) throw new Error('Coordinates must include a revision')
    if (curation && typeof curation !== 'number' && typeof curation !== 'string') return curation
    const all = await this.getAll(coordinates, curation)
    if (!all || !all.revisions) return null
    const result = all.revisions[coordinates.revision]
    if (!result) return null
    // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
    Object.defineProperty(result, '_origin', { value: all._origin, enumerable: false })
    return result
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
  getAll(coordinates, pr = null) {
    return pr ? this._getAllGitHub(coordinates, pr) : this._getAllLocal(coordinates)
  }

  async _getAllLocal(coordinates) {
    const { owner, repo } = this.options
    await this.ensureCurations()
    const filePath = `${this.tempLocation.name}/${this.options.repo}/${this._getSearchRoot(coordinates)}.yaml`
    var result
    try {
      result = yaml.safeLoad(fs.readFileSync(filePath))
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    const res = await this._getLocalSha(filePath)
    set(result, '_origin', { sha: res.split(" ")[1], enumerable: false })
    return result
  }

  async _getLocalSha(filepath) {
    const parent = path.dirname(filepath)
    const command = `cd ${parent} && git ls-files -s ${path.basename(filepath)}`
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout)
      })
    })
  }

  async _getAllGitHub(coordinates, pr = null) {
    const curationPath = this._getCurationPath(coordinates)
    const { owner, repo } = this.options
    const branch = await this.getBranch(pr)

    const github = Github.getClient(this.options)
    try {
      const contentResponse = await github.repos.getContent({ owner, repo, ref: branch, path: curationPath })
      const content = yaml.safeLoad(base64.decode(contentResponse.data.content))
      // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
      Object.defineProperty(content, '_origin', { value: { sha: contentResponse.data.sha }, enumerable: false })
      return content
    } catch (error) {
      // TODO: This isn't very safe how it is because any failure will return an empty object,
      // ideally we only do this if the .yaml file doesn't exist.
      return null
    }
  }

  async getBranch(number) {
    if (!number) return this.options.branch
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    const result = await github.pullRequests.get({ owner, repo, number })
    return result.data.head.ref
  }

  async getCurations(number, ref) {
    const prFiles = await this.getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this.isCurationFile)
    return Promise.all(
      curationFilenames.map(path => this.getContent(ref, path).then(content => new Curation(content, null, path)))
    )
  }

  async apply(coordinates, curationSpec, summarized) {
    const curation = await this.get(coordinates, curationSpec)
    return curation ? extend(true, {}, summarized, curation) : summarized
  }

  async getContent(ref, path) {
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    try {
      const response = await github.repos.getContent({ owner, repo, ref, path })
      return base64.decode(response.data.content)
    } catch (error) {
      // @todo add logger
    }
  }

  async handleMerge(number, ref) {
    const curations = await this.getCurations(number, ref)
    const coordinateSet = curations.filter(x => x.isValid).map(c => c.getCoordinates())
    const coordinateList = concat([], ...coordinateSet)
    return this.definitionService.invalidate(coordinateList)
  }

  async validateCurations(number, componentPath, sha, ref) {
    await this.postCommitStatus(sha, number, componentPath, 'pending', 'Validation in progress')
    const curations = await this.getCurations(number, ref)
    const invalidCurations = curations.filter(x => !x.isValid)
    let state = 'success'
    let description = 'All curations are valid'
    if (invalidCurations.length) {
      state = 'error'
      description = `Invalid curations: ${invalidCurations.map(x => x.path).join(', ')}`
    }
    return this.postCommitStatus(sha, number, componentPath, state, description)
  }

  async postCommitStatus(sha, number, componentPath, state, description) {
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    const target_url = `${this.endpoints.website}/curate/${componentPath}/pr/${number}`
    try {
      return github.repos.createStatus({
        owner,
        repo,
        sha,
        state,
        description,
        target_url,
        context: 'ClearlyDefined'
      })
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
    await this.ensureCurations()
    const root = `${this.tempLocation.name}/${this.options.repo}/${this._getSearchRoot(coordinates)}`
    if (!fs.existsSync(root)) return []
    return new Promise((resolve, reject) => {
      const result = []
      readdirp({ root, fileFilter: '*.yaml' })
        .on('data', entry => result.push(...this.handleEntry(entry)))
        .on('end', () => resolve(result))
        .on('error', reject)
    })
  }

  handleEntry(entry) {
    const curation = yaml.safeLoad(fs.readFileSync(entry.fullPath.replace(/\\/g, '/')))
    const { coordinates: c, revisions } = curation
    const root = `${c.type}/${c.provider}/${c.namespace || '-'}/${c.name}/`
    return Object.getOwnPropertyNames(revisions).map(version => root + version)
  }

  async ensureCurations() {
    if (this.curationUpdateTime && (Date.now() - this.curationUpdateTime < this.options.curationFreshness)) return
    const { owner, repo } = this.options
    const url = `https://github.com/${owner}/${repo}.git`
    this.tempLocation = this.tempLocation || tmp.dirSync(this.tmpOptions)
    // if the location does not exist (perhaps it got deleted?), create it.
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.tempLocation.name)) {
        this.tempLocation = tmp.dirSync(this.tmpOptions)
        // if it's still not there bail. Perhaps permissions problem
        if (!fs.existsSync(this.tempLocation.name)) reject(new Error('Curation cache location could not be created'))
      }
      const command = this.curationUpdateTime
        ? `cd ${this.tempLocation.name}/${repo} && git pull`
        : `cd ${this.tempLocation.name} && git clone ${url}`
      this.curationUpdateTime = Date.now()
      exec(command, (error, stdout) => {
        if (error) {
          this.curationUpdateTime = null
          return reject(error)
        }
        resolve(stdout)
      })
    })
  }

  async getPrFiles(number) {
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    try {
      const response = await github.pullRequests.getFiles({ owner, repo, number })
      return response.data
    } catch (error) {
      // @todo add logger
      throw error
    }
  }

  _getPrTitle(coordinates) {
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return coordinates.toString()
  }

  async _getBranchName(userGithub, serviceGithub) {
    const committer = userGithub ? await userGithub.users.get({}) : await serviceGithub.users.get({})
    return `${committer.data.name.toLowerCase().replace(/ /g, "_")}_${moment().format('YYMMDD_HHmmss.SSS')}`
  }



  _getCurationPath(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}.yaml`
  }

  _getSearchRoot(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}`
  }

  // @todo perhaps validate directory structure based on coordinates
  isCurationFile(path) {
    return path.startsWith('curations/') && path.endsWith('.yaml')
  }
}

module.exports = (options, endpoints, definitionService) =>
  new GitHubCurationService(options, endpoints, definitionService)
