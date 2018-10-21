// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { concat, isEqual, uniq } = require('lodash')
const base64 = require('base-64')
const { exec } = require('child_process')
const fs = require('fs')
const readdirp = require('readdirp')
const requestPromise = require('request-promise-native')
const yaml = require('js-yaml')
const Github = require('../../lib/github')
const Curation = require('../../lib/curation')
const EntityCoordinates = require('../../lib/entityCoordinates')
const tmp = require('tmp')
tmp.setGracefulCleanup()

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationStore {
  constructor(options) {
    this.options = options
    this.curationUpdateTime = null
    this.tempLocation = null
  }

  get tmpOptions() {
    return {
      unsafeCleanup: true,
      template: `${this.options.tempLocation}/cd-XXXXXX`
    }
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

  async _getBranchAndSha(number) {
    if (!number) return { ref: this.options.branch }
    const { owner, repo } = this.options
    const github = Github.getClient(this.options)
    const result = await github.pullRequests.get({ owner, repo, number })
    return { ref: result.data.head.ref, sha: result.data.head.sha }
  }

  async getCurations(number, ref) {
    const prFiles = await this._getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this._isCurationFile)
    return Promise.all(
      curationFilenames.map(path => this._getContent(ref, path).then(content => new Curation(content, path)))
    )
  }

  async _getContent(ref, path) {
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

  /**
   * Given a partial spec, return the list of full spec urls for each curated version of the spec'd components
   * @param {EntityCoordinates} coordinates - the partial coordinates that describe the sort of curation to look for.
   * @returns {[URL]} - Array of URLs describing the available curations
   */
  async list(coordinates) {
    await this._ensureCurations()
    const root = `${this.tempLocation.name}/${this.options.repo}/${this._getSearchRoot(coordinates)}`
    if (!fs.existsSync(root)) return []
    return new Promise((resolve, reject) => {
      const result = []
      readdirp({ root, fileFilter: '*.yaml' })
        .on('data', entry => result.push(...this._handleRepoEntry(entry)))
        .on('end', () => resolve(result))
        .on('error', reject)
    })
  }

  _handleRepoEntry(entry) {
    const curation = yaml.safeLoad(fs.readFileSync(entry.fullPath.replace(/\\/g, '/')))
    const { coordinates: c, revisions } = curation
    const root = `${c.type}/${c.provider}/${c.namespace || '-'}/${c.name}/`
    return Object.getOwnPropertyNames(revisions).map(version => root + version)
  }

  async _ensureCurations() {
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

  async _getPrFiles(number) {
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
    const files = await this._getPrFiles(number)
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

  _getCurationPath(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}.yaml`
  }

  _getSearchRoot(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}`
  }

  // @todo perhaps validate directory structure based on coordinates
  _isCurationFile(path) {
    return path.startsWith('curations/') && path.endsWith('.yaml')
  }
}

module.exports = options => new GitHubCurationStore(options)
