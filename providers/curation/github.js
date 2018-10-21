// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { concat, get, forIn, merge, isEqual, uniq } = require('lodash')
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
tmp.setGracefulCleanup()

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  constructor(options, store, endpoints, definition = null) {
    this.options = options
    this.store = store
    this.definitionService = definition
    this.endpoints = endpoints
    this.curationUpdateTime = null
    this.tempLocation = null
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

    // TODO getAll is needed both here and in the github store factor out
    const currentContent = await this.store.getAll(coordinates)
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

  async apply(coordinates, curationSpec, definition) {
    const curation = await this.store.get(coordinates, curationSpec)
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

  async validateCurations(number, sha, ref) {
    await this.postCommitStatus(sha, number, 'pending', 'Validation in progress')
    const curations = await this.store.getCurations(number, ref)
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

  prOpened(pr) {
    return this.store.updatePR(pr)
  }

  prClosed(pr) {
    return this.store.updatePR(pr)
  }

  prMerged(pr) {
    return this.store.updatePR(pr)
    const coordinateList = await this.getCurationCoordinates(pr.number, pr.head.ref)
    // invalidate all affected definitions then recompute. This ensures the changed defs are cleared out 
    // even if there are errors recomputing the definitions.
    await this.definitionService.invalidate(coordinateList)
    await Promise.all(coordinateList.map(coordinates => this.definitionService.computeAndStore(coordinates)))
    }

  async prUpdated(pr) {
    await this.store.updatePR(pr)
    return this.validateCurations(pr.number, pr.head.sha, pr.head.ref)
  }

  _getCurationPath(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}.yaml`
  }

  getCurationUrl(number) {
    return `https://github.com/${this.options.owner}/${this.options.repo}/pull/${number}`
  }

  async _getBranchName(info) {
    return `${info.login}_${moment().format('YYMMDD_HHmmss.SSS')}`
  }
}

module.exports = (options, store, endpoints, definition) => new GitHubCurationService(options, store, endpoints, definition)
