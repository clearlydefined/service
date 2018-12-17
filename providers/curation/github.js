// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { concat, get, forIn, merge, isEqual, uniq, pick } = require('lodash')
const base64 = require('base-64')
const moment = require('moment')
const requestPromise = require('request-promise-native')
const yaml = require('js-yaml')
const throat = require('throat')
const Github = require('../../lib/github')
const Curation = require('../../lib/curation')
const EntityCoordinates = require('../../lib/entityCoordinates')
const tmp = require('tmp')
tmp.setGracefulCleanup()
const logger = require('../logging/logger')

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  constructor(options, store, endpoints, definition) {
    this.logger = logger()
    this.options = options
    this.store = store
    this.endpoints = endpoints
    this.definitionService = definition
    this.curationUpdateTime = null
    this.tempLocation = null
    this.github = Github.getClient(options)
    this.logger = logger()
  }

  get tmpOptions() {
    return {
      unsafeCleanup: true,
      template: `${this.options.tempLocation}/cd-XXXXXX`
    }
  }

  /**
   * Enumerate all contributions in GitHub and in the store and updates any out of sync
   * @returns Promise indicating the operation is complete. The value of the resolved promise is undefined.
   */
  async syncAllContributions(client) {
    let response = await client.pullRequests.getAll({
      owner: this.options.owner,
      repo: this.options.repo,
      per_page: 100,
      state: 'all'
    })
    this._processContributions(response.data)
    while (this.github.hasNextPage(response)) {
      response = await this.github.getNextPage(response)
      this._processContributions(response.data)
    }
  }

  async _processContributions(prs) {
    for (let pr of prs) {
      const storedContribution = await this.store.getContribution(pr.number)
      const storedUpdated = get(storedContribution, 'pr.updated_at')
      if (!storedUpdated || new Date(storedUpdated).getTime() < new Date(pr.updated_at).getTime()) {
        this.logger.info(`Backfilling contribution for #${pr.number}`)
        await this.updateContribution(pr)
      }
    }
  }

  /**
   * Persist the updated contribution in the store and handle newly merged contributions
   * @param {*} pr - The GitHub PR object
   * @param {*} curations -Optional. The contributed curations for this PR
   * @returns Promise indicating the operation is complete. The value of the resolved promise is undefined.
   */
  async updateContribution(pr, curations = null) {
    curations = curations || (await this.getContributedCurations(pr.number, pr.head.sha))
    const data = {
      ...pick(pr, [
        'number',
        'id',
        'state',
        'title',
        'body',
        'created_at',
        'updated_at',
        'closed_at',
        'merged_at',
        'merge_commit_sha'
      ]),
      user: pick(pr.user, ['login']),
      head: { ...pick(pr.head, ['sha']), repo: { ...pick(get(pr, 'head.repo'), ['id']) } },
      base: { ...pick(pr.base, ['sha']), repo: { ...pick(get(pr, 'base.repo'), ['id']) } }
    }
    await this.store.updateContribution(data, curations)
    if (data.merged_at) await this._prMerged(curations)
  }

  /**
   * Process the fact that the given PR has been merged by persisting the curation and invalidating the defintion
   * @param {*} curations - The set of actual proposed changes
   * @returns Promise indicating the operation is complete. The value of the resolved promise is undefined.
   * @throws Exception with `code` === 404 if the given PR is missing. Other exceptions may be thrown related
   * to interaction with GitHub or PR storage
   */
  async _prMerged(curations) {
    await this.store.updateCurations(curations)
    // invalidate all affected definitions then recompute. This ensures the changed defs are cleared out
    // even if there are errors recomputing the definitions.
    const coordinateList = Curation.getAllCoordinates(curations)
    await this.definitionService.invalidate(coordinateList)
    return Promise.all(
      coordinateList.map(
        throat(5, coordinates => {
          this.definitionService
            .computeAndStore(coordinates)
            .catch(error => this.logger.info(`Failed to compute/store ${coordinates.toString()}: ${error.toString()}`))
        })
      )
    )
  }

  async validateContributions(number, sha, curations) {
    await this._postCommitStatus(sha, number, 'pending', 'Validation in progress')
    const invalidCurations = curations.filter(x => !x.isValid)
    let state = 'success'
    let description = 'All curations are valid'
    if (invalidCurations.length) {
      state = 'error'
      description = `Invalid curations: ${invalidCurations.map(x => x.path).join(', ')}`
    }
    return this._postCommitStatus(sha, number, state, description)
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
    const currentContent = await this._getCurations(coordinates)
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

  // Return an array of valid patches that exist
  // and a list of definitions that do not exist in the store
  async _validateDefinitionsExist(patches) {
    const targetCoordinates = patches.reduce((result, patch) => {
      for (let key in patch.revisions)
        result.push(EntityCoordinates.fromObject({ ...patch.coordinates, revision: key }))
      return result
    }, [])
    const validDefinitions = await this.definitionService.listAll(targetCoordinates)
    return targetCoordinates.reduce(
      (result, coordinates) => {
        result[validDefinitions.find(definition => isEqual(definition, coordinates)) ? 'valid' : 'missing'].push(
          coordinates
        )
        return result
      },
      { valid: [], missing: [] }
    )
  }

  async addOrUpdate(userGithub, serviceGithub, info, patch) {
    const { owner, repo, branch } = this.options
    const { missing } = await this._validateDefinitionsExist(patch.patches)
    if (missing.length > 0)
      throw new Error('The contribution has failed because some of the supplied component definitions do not exist')
    const masterBranch = await serviceGithub.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
    const sha = masterBranch.data.commit.sha
    const prBranch = await this._getBranchName(info)
    await serviceGithub.gitdata.createReference({ owner, repo, ref: `refs/heads/${prBranch}`, sha })
    await Promise.all(
      // Throat value MUST be kept at 1, otherwise GitHub will write concurrent patches
      patch.patches.map(throat(1, component => this._writePatch(serviceGithub, info, component, prBranch)))
    )
    const { type, details, summary, resolution } = patch.contributionInfo
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
${this._formatDefinitions(patch.patches)}`

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

  _formatDefinitions(definitions) {
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
    const all = await this._getCurations(coordinates, curation)
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
  async _getCurations(coordinates, pr = null) {
    // Check to see if there is content for the given coordinates
    const path = this._getCurationPath(coordinates)
    const { owner, repo } = this.options
    const branch = await this._getBranchAndSha(pr)
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
    try {
      const contentResponse = await this.github.repos.getContent({ owner, repo, ref, path })
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

  async _getBranchAndSha(number) {
    if (!number) return { ref: this.options.branch }
    const { owner, repo } = this.options
    const result = await this.github.pullRequests.get({ owner, repo, number })
    return { ref: result.data.head.ref, sha: result.data.head.sha }
  }

  /**
   * get the content for all curations in a given PR
   * @param {*} number - The GitHub PR number
   * @param {*} sha - The GitHub PR head sha
   * @returns {[Curation]} Promise for an array of Curations
   */
  async getContributedCurations(number, sha) {
    const prFiles = await this._getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this.isCurationFile)
    return Promise.all(
      curationFilenames.map(
        throat(10, async path => {
          const content = await this._getContent(sha, path)
          return new Curation(content, path)
        })
      )
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

  async _getContent(ref, path) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.repos.getContent({ owner, repo, ref, path })
      return base64.decode(response.data.content)
    } catch (error) {
      this.logger.info(`Failed to get content for ${owner}/${repo}/${ref}/${path}`)
    }
  }

  async _postCommitStatus(sha, number, state, description) {
    const { owner, repo } = this.options
    const target_url = `${this.endpoints.website}/curations/${number}`
    try {
      return this.github.repos.createStatus({
        owner,
        repo,
        sha,
        state,
        description,
        target_url,
        context: 'ClearlyDefined'
      })
    } catch (error) {
      this.logger.info(`Failed to create status for PR #${number}`)
    }
  }

  /**
   * Given partial coordinates, return a list of full coordinates for which we have merged curations
   * @param {EntityCoordinates} coordinates - the partial coordinates that describe the sort of curation to look for.
   * @returns {[EntityCoordinates]} - Array of coordinates describing the available curations
   */
  async list(coordinates) {
    return this.store.list(coordinates)
  }

  getCurationUrl(number) {
    return `https://github.com/${this.options.owner}/${this.options.repo}/pull/${number}`
  }

  // get the list of files changed in the given PR.
  async _getPrFiles(number) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.pullRequests.getFiles({ owner, repo, number })
      return response.data
    } catch (error) {
      if (error.code === 404) throw error
      throw new Error(`Error calling GitHub to get pr#${number}. Code ${error.code}`)
    }
  }

  async getChangedDefinitions(number) {
    const files = await this._getPrFiles(number)
    const changedCoordinates = []
    for (let i = 0; i < files.length; ++i) {
      const fileName = files[i].filename.replace(/\.yaml$/, '').replace(/^curations\//, '')
      const coordinates = EntityCoordinates.fromString(fileName)
      const prDefinitions = (await this._getCurations(coordinates, number)) || { revisions: [] }
      const masterDefinitions = (await this._getCurations(coordinates)) || { revisions: [] }
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
}

module.exports = (options, store, endpoints, definition) =>
  new GitHubCurationService(options, store, endpoints, definition)
