// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { concat, get, forIn, merge, set, isEqual, uniq } = require('lodash')
const base64 = require('base-64')
const { exec } = require('child_process')
const fs = require('fs')
const moment = require('moment')
const readdirp = require('readdirp')
const requestPromise = require('request-promise-native')
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
    const newCoordinates = EntityCoordinates.fromObject(coordinates).asRevisionless()
    const result = {
      coordinates: newCoordinates,
      revisions: get(currentContent, 'revisions') || {}
    }
    forIn(newContent, (value, key) => (result.revisions[key] = merge(result.revisions[key] || {}, value)))
    return yaml.safeDump(result, { sortKeys: true, lineWidth: 150 })
  }

  async _writePatch(serviceGithub, info, patch, branch) {
    const { owner, repo } = this.options
    const coordinates = EntityCoordinates.fromObject(patch.coordinates)
    const currentContent = await this.getAll(coordinates)
    const newContent = patch.revisions
    const updatedContent = this._updateContent(coordinates, currentContent, newContent)
    const content = base64.encode(updatedContent)
    const path = this._getCurationPath(coordinates)
    const message = `Update ${path}`
    const fileBody = {
      owner,
      repo,
      path,
      message,
      content,
      branch
    }

    // Github requires name/email to set committer
    if ((info.name || info.login) && info.email)
      fileBody.committer = { name: info.name || info.login, email: info.email }
    if (get(currentContent, '_origin.sha')) {
      fileBody.sha = currentContent._origin.sha
      return serviceGithub.repos.updateFile(fileBody)
    }
    return serviceGithub.repos.createFile(fileBody)
  }

  async addOrUpdate(userGithub, serviceGithub, info, patch) {
    const { owner, repo, branch } = this.options
    const masterBranch = await serviceGithub.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
    const sha = masterBranch.data.commit.sha
    const prBranch = await this._getBranchName(info)
    await serviceGithub.gitdata.createReference({ owner, repo, ref: `refs/heads/${prBranch}`, sha })
    await Promise.all(
      patch.patches.map(throat(1, component => this._writePatch(serviceGithub, info, component, prBranch)))
    )
    const { type, details, summary, resolution } = patch.constributionInfo
    const Type = type.charAt(0).toUpperCase() + type.substr(1)
    const description = `
**Type:** ${Type}

**Summary:**
${summary}

**Details:**
${details}

**Resolution:**
${resolution}

**Affected definitions**:
${this.formatDefinitions(patch.patches)}`

    const result = await (userGithub || serviceGithub).pullRequests.create({
      owner,
      repo,
      title: prBranch,
      body: description,
      head: `refs/heads/${prBranch}`,
      base: branch
    })
    const number = result.data.number
    const comment = {
      owner,
      repo,
      number,
      body: `You can review the change introduced to the full definition at [ClearlyDefined](https://clearlydefined.io/curations/${number}).`
    }
    await serviceGithub.issues.createComment(comment)
    return result
  }

  formatDefinitions(definitions) {
    return definitions.map(def => `- ${def.coordinates.name} ${Object.keys(def.revisions)[0]}`)
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
  async getAll(coordinates, pr = null) {
    // Check to see if there is content for the given coordinates
    const path = this._getCurationPath(coordinates)
    const { owner, repo } = this.options
    const branch = await this.getBranchAndSha(pr)
    const branchName = branch.sha || branch.ref
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branchName}/${path}`
    const content = await requestPromise({ url, method: 'HEAD', resolveWithFullResponse: true, simple: false })
    if (content.statusCode !== 200) return null
    // If there is content, go and get it. This is a little wasteful (two calls) but
    // a) the vast majority of coordinates will not have any curation
    // b) we need the sha of the curation to form part of the final definition tool chain
    // At some point in the future we can look at caching and etags etc
    return this._getFullContent(coordinates, branch.ref)
  }

  async _getFullContent(coordinates, ref) {
    const path = this._getCurationPath(coordinates)
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    try {
      const contentResponse = await github.repos.getContent({ owner, repo, ref, path })
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

  async getBranchAndSha(number) {
    if (!number) return { ref: this.options.branch }
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    const result = await github.pullRequests.get({ owner, repo, number })
    return { ref: result.data.head.ref, sha: result.data.head.sha }
  }

  async getCurations(number, ref) {
    const prFiles = await this.getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this.isCurationFile)
    return Promise.all(
      curationFilenames.map(path => this.getContent(ref, path).then(content => new Curation(content, path)))
    )
  }

  async apply(coordinates, curationSpec, definition) {
    const curation = await this.get(coordinates, curationSpec)
    const result = Curation.apply(definition, curation)
    this._ensureCurationInfo(result, curation)
    return result
  }

  _ensureCurationInfo(definition, curation) {
    if (!curation) return
    if (Object.getOwnPropertyNames(curation).length === 0) return
    const origin = get(curation, '_origin.sha')
    definition.described = definition.described || {}
    definition.described.tools = definition.described.tools || []
    definition.described.tools.push(`curation/${origin ? origin : 'supplied'}`)
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

  async getCurationCoordinates(number, ref) {
    const curations = await this.getCurations(number, ref)
    const coordinateSet = curations.filter(x => x.isValid).map(c => c.getCoordinates())
    return concat([], ...coordinateSet)
  }

  async validateCurations(number, sha, ref) {
    await this.postCommitStatus(sha, number, 'pending', 'Validation in progress')
    const curations = await this.getCurations(number, ref)
    const invalidCurations = curations.filter(x => !x.isValid)
    let state = 'success'
    let description = 'All curations are valid'
    if (invalidCurations.length) {
      state = 'error'
      description = `Invalid curations: ${invalidCurations.map(x => x.path).join(', ')}`
    }
    return this.postCommitStatus(sha, number, state, description)
  }

  async postCommitStatus(sha, number, state, description) {
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    const target_url = `${this.endpoints.website}/curations/${number}`
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
    if (this.curationUpdateTime && Date.now() - this.curationUpdateTime < this.options.curationFreshness) return
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

  async getChangedDefinitions(number) {
    const files = await this.getPrFiles(number)
    const changedCoordinates = []
    for (let i = 0; i < files.length; ++i) {
      const fileName = files[i].filename.replace(/\.yaml$/, '').replace(/^curations\//, '')
      const coordinates = EntityCoordinates.fromString(fileName)
      const prDefinitions = (await this.getAll(coordinates, number)) || { revisions: [] }
      const masterDefinitions = (await this.getAll(coordinates)) || { revisions: [] }
      const allUnfilteredRevisions = concat(
        Object.keys(prDefinitions.revisions),
        Object.keys(masterDefinitions.revisions)
      )
      const allRevisions = uniq(allUnfilteredRevisions)
      const changedRevisions = allRevisions.filter(
        revision => !isEqual(prDefinitions.revisions[revision], masterDefinitions.revisions[revision])
      )
      changedRevisions.forEach(revision => changedCoordinates.push(`${fileName}/${revision}`))
    }
    return changedCoordinates
  }

  _getPrTitle(coordinates) {
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return coordinates.toString()
  }

  async _getBranchName(info) {
    return `${info.login}_${moment().format('YYMMDD_HHmmss.SSS')}`
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

  toEntityCoordinate(coordinates) {
    return new EntityCoordinates(
      coordinates.type,
      coordinates.provider,
      coordinates.namespace,
      coordinates.name,
      coordinates.revision
    )
  }
}

module.exports = (options, endpoints, definitionService) =>
  new GitHubCurationService(options, endpoints, definitionService)
