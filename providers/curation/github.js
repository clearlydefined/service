// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('../../lib/curation').CurationData} CurationData */
/** @typedef {import('../../lib/curation').CurationRevision} CurationRevision */
/** @typedef {import('../../lib/utils').Definition} Definition */
/** @typedef {import('../../lib/github').GitHubClient} GitHubClient */
/** @typedef {import('../caching').ICache} ICache */
/** @typedef {import('.').GitHubCurationOptions} GitHubCurationOptions */
/** @typedef {import('.').Endpoints} Endpoints */
/** @typedef {import('.').ICurationStore} ICurationStore */
/** @typedef {import('.').CurationDefinitionService} CurationDefinitionService */
/** @typedef {import('.').CurationHarvestStore} CurationHarvestStore */
/** @typedef {import('.').GitHubPR} GitHubPR */
/** @typedef {import('./github').GitHubUserInfo} GitHubUserInfo */
/** @typedef {import('.').ContributionInfo} ContributionInfo */
/** @typedef {import('.').CurationPatch} CurationPatch */
/** @typedef {import('.').CurationPatchEntry} CurationPatchEntry */
/** @typedef {import('.').CurationListResult} CurationListResult */
/** @typedef {import('.').MatchingRevisionAndReason} MatchingRevisionAndReason */
/** @typedef {import('.').MatchingProperty} MatchingProperty */
/** @typedef {import('./github').CommitStatusState} CommitStatusState */

const {
  concat,
  get,
  forIn,
  merge,
  isEqual,
  uniq,
  pick,
  flatten,
  flatMap,
  first,
  union,
  unset,
  uniqWith
} = require('lodash')
const { DateTime } = require('luxon')
const geit = require('geit')
const yaml = require('js-yaml')
const throat = require('throat')
const Github = require('../../lib/github')
const Curation = require('../../lib/curation')
const EntityCoordinates = require('../../lib/entityCoordinates')
const tmp = require('tmp')
tmp.setGracefulCleanup()
const logger = require('../logging/logger')
const semver = require('semver')
const { LicenseMatcher } = require('../../lib/licenseMatcher')
const { Cache } = require('memory-cache')
const { deCodeSlashes } = require('../../lib/utils')

const hourInMS = 60 * 60 * 1000

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  /**
   * @param {GitHubCurationOptions} options
   * @param {ICurationStore} store
   * @param {Endpoints} endpoints
   * @param {CurationDefinitionService} definition
   * @param {ICache} cache
   * @param {CurationHarvestStore} harvestStore
   * @param {LicenseMatcher} [licenseMatcher]
   */
  constructor(options, store, endpoints, definition, cache, harvestStore, licenseMatcher) {
    this.logger = logger()
    this.options = options
    this.store = store
    this.endpoints = endpoints
    this.definitionService = definition
    this.curationUpdateTime = null
    this.tempLocation = null
    this.github = Github.getClient(options)
    this.cache = cache
    this.logger = logger()
    this.harvestStore = harvestStore
    this.licenseMatcher = licenseMatcher || new LicenseMatcher()
    this.smartGit = this._initSmartGit(options)
    this.treeCache = new Cache()
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
  /** @param {*} client */
  async syncAllContributions(client) {
    /** @type {string[]} */
    const states = ['open', 'closed']
    for (const state of states) {
      /** @type {*} */
      let prOptions = {
        owner: this.options.owner,
        repo: this.options.repo,
        per_page: 100,
        state
      }
      //See https://docs.github.com/en/rest/reference/pulls#list-pull-requests
      if (state === 'closed') prOptions = { ...prOptions, sort: 'updated', direction: 'asc' }
      let response = await client.pullRequests.getAll(prOptions)
      this._processContributions(response.data)
      while (/** @type {*} */ (this.github).hasNextPage(response)) {
        response = await /** @type {*} */ (this.github).getNextPage(response)
        this._processContributions(response.data)
      }
    }
  }

  /** @param {GitHubPR[]} prs */
  async _processContributions(prs) {
    for (const pr of prs) {
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
   * @param {GitHubPR} pr - The GitHub PR object
   * @param {Curation[] | null} [curations] - Optional. The contributed curations for this PR
   * @returns {Promise<void>} Promise indicating the operation is complete.
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
    this._cleanCurationTree(pr.number)
    await this.store.updateContribution(data, curations)
    let toBeCleaned = flatten(curations.map(curation => curation.getCoordinates()))
    // Should also delete revision less coordinate curation cache
    toBeCleaned = uniqWith(toBeCleaned.concat(toBeCleaned.map(c => c.asRevisionless())), isEqual)
    await Promise.all(
      toBeCleaned.map(throat(10, async coordinates => this.cache.delete(this._getCacheKey(coordinates))))
    )
    if (data.merged_at) await this._prMerged(curations)
  }

  /**
   * Process the fact that the given PR has been merged by persisting the curation and invalidating the definition
   * @param {Curation[]} curations - The set of actual proposed changes
   * @returns {Promise<(void | Definition)[]>}
   */
  async _prMerged(curations) {
    this._cleanCurationTree()
    await this.store.updateCurations(curations)
    // invalidate all affected definitions then recompute. This ensures the changed defs are cleared out
    // even if there are errors recomputing the definitions.
    const coordinateList = Curation.getAllCoordinates(curations)
    await this.definitionService.invalidate(coordinateList)
    return Promise.all(
      coordinateList.map(
        throat(5, coordinates => {
          return this.definitionService
            .computeAndStore(coordinates)
            .catch(
              /** @type {*} */ error =>
                this.logger.info(`Failed to compute/store ${coordinates.toString()}: ${error.toString()}`)
            )
        })
      )
    )
  }

  /**
   * @param {number} number
   * @param {string} sha
   * @param {Curation[]} curations
   */
  async validateContributions(number, sha, curations) {
    await this._postCommitStatus(sha, number, 'pending', 'Validation in progress')
    const invalidCurations = curations.filter(x => !x.isValid)
    /** @type {CommitStatusState} */
    let state = 'success'
    let description = 'All curations are valid'
    if (invalidCurations.length) {
      state = 'error'
      description = `Invalid curations: ${invalidCurations.map(x => x.path).join(', ')}`
      this.logger.error(description, invalidCurations)

      let error_string = 'We discovered some errors in this curation when validating it:\n\n'

      for (const invalid_curation of invalidCurations) {
        for (const err of invalid_curation.errors) {
          error_string += `${err.error}\n`
        }
      }
      await this._postErrorsComment(number, error_string)
    }
    return this._postCommitStatus(sha, number, state, description)
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @param {EntityCoordinates[]} otherCoordinatesList
   */
  async _startMatching(coordinates, otherCoordinatesList) {
    const definition = await this.definitionService.getStored(coordinates)
    const harvest = await this.harvestStore.getAll(coordinates)
    /** @type {MatchingRevisionAndReason[]} */
    const matches = []

    await Promise.all(
      otherCoordinatesList.map(async otherCoordinates => {
        const otherDefinition = await this.definitionService.getStored(otherCoordinates)
        const otherHarvest = await this.harvestStore.getAll(otherCoordinates)
        const result = this.licenseMatcher.process(
          { definition, harvest },
          { definition: otherDefinition, harvest: otherHarvest }
        )

        if (result.isMatching) {
          matches.push({
            version: otherCoordinates.revision,
            matchingProperties: result.match.map(reason => {
              if (reason.file) {
                return { file: reason.file }
              }
              return { propPath: reason.propPath, value: reason.value }
            })
          })
        }
      })
    )

    return matches
  }

  /** @param {CurationListResult} curations */
  _getRevisionsFromCurations(curations) {
    /** @type {string[]} */
    let revisions = []

    Object.keys(curations.curations).forEach(coordinate => {
      const coordinateObject = EntityCoordinates.fromString(coordinate)
      revisions.push(coordinateObject.revision)
    })

    curations.contributions.forEach(
      /** @param {*} contribution */ contribution => {
        contribution.files.forEach(
          /** @param {*} file */ file => {
            const fileRevisions = get(file, 'revisions', {}).map(
              /** @param {*} revision */ revision => revision.revision
            )
            revisions = union(revisions, fileRevisions)
          }
        )
      }
    )

    return revisions
  }

  /** @param {EntityCoordinates} coordinates */
  async _calculateMatchingRevisionAndReason(coordinates) {
    const revisionlessCoords = coordinates.asRevisionless()
    const coordinatesList = await this.definitionService.list(revisionlessCoords)
    const filteredCoordinatesList = coordinatesList
      .map(stringCoords => EntityCoordinates.fromString(stringCoords))
      .filter(
        coords =>
          coordinates.name === coords.name &&
          coordinates.revision !== coords.revision &&
          coords.revision !== 'undefined'
      )

    const matchingRevisionsAndReasons = await this._startMatching(coordinates, filteredCoordinatesList)
    const curations = /** @type {CurationListResult} */ (await this.list(revisionlessCoords))
    const existingRevisions = this._getRevisionsFromCurations(curations)

    const uncuratedMatchingRevisions = matchingRevisionsAndReasons.filter(
      versionAndReason => existingRevisions.indexOf(versionAndReason.version) === -1
    )
    return uncuratedMatchingRevisions
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @param {CurationRevision} curation
   * @param {MatchingRevisionAndReason[]} matchingRevisionAndReason
   */
  async _filterRevisionWithDeclaredLicense(coordinates, curation, matchingRevisionAndReason) {
    const filtered = []
    for (const revisionAndReason of matchingRevisionAndReason) {
      const { version } = revisionAndReason
      const matchingCoordinates = EntityCoordinates.fromObject({ ...coordinates, revision: version })
      const matchingDefinition = await this.definitionService.getStored(matchingCoordinates)
      const existingDeclaredLicense = get(matchingDefinition, 'licensed.declared')
      if (!existingDeclaredLicense || existingDeclaredLicense === 'NOASSERTION') {
        filtered.push(revisionAndReason)
      } else {
        if (existingDeclaredLicense !== get(curation, 'licensed.declared')) {
          this.logger.info(
            'GitHubCurationService._filterRevisionWithDeclaredLicense.ExistingLicenseNotEqualToCuratedLicense',
            {
              coordinates: coordinates.toString(),
              revisionAndReason,
              curation,
              existingLicense: existingDeclaredLicense
            }
          )
        }
      }
    }
    return filtered
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @param {CurationData} currentContent
   * @param {Record<string, CurationRevision>} newContent
   */
  _updateContent(coordinates, currentContent, newContent) {
    const newCoordinates = EntityCoordinates.fromObject(coordinates).asRevisionless()
    const result = {
      coordinates: newCoordinates,
      revisions: get(currentContent, 'revisions') || {}
    }
    forIn(newContent, (value, key) => (result.revisions[key] = merge(result.revisions[key] || {}, value)))
    return yaml.dump(result, { sortKeys: true, lineWidth: 150 })
  }

  /**
   * @param {GitHubClient | null} userGithub
   * @param {GitHubClient} serviceGithub
   * @param {GitHubUserInfo} info
   * @param {CurationPatchEntry} patch
   * @param {string} branch
   */
  async _writePatch(userGithub, serviceGithub, info, patch, branch) {
    const { owner, repo } = this.options
    const coordinates = EntityCoordinates.fromObject(patch.coordinates)
    const currentContent = await this._getCurations(coordinates)
    const newContent = patch.revisions
    const updatedContent = this._updateContent(coordinates, currentContent, newContent)
    const content = Buffer.from(updatedContent).toString('base64')
    const path = this._getCurationPath(coordinates)
    const message = `Update ${path}`
    /** @type {{ owner: string, repo: string, path: string, message: string, content: string, branch: string, committer?: { name: string, email: string }, sha?: string }} */
    const fileBody = {
      owner,
      repo,
      path,
      message,
      content,
      branch
    }

    if (userGithub) {
      const { name, email } = await this._getUserInfo(userGithub)
      if (name && email) fileBody.committer = { name, email }
    }

    // Github requires name/email to set committer
    if ((info.name || info.login) && info.email)
      fileBody.committer = { name: info.name || info.login, email: info.email }
    if (get(currentContent, '_origin.sha')) {
      fileBody.sha = /** @type {*} */ (currentContent)._origin.sha
      return serviceGithub.rest.repos.createOrUpdateFileContents(fileBody)
    }
    return serviceGithub.rest.repos.createOrUpdateFileContents(fileBody)
  }

  /** @param {GitHubClient} githubCli */
  async _getUserInfo(githubCli) {
    const user = await /** @type {*} */ (githubCli.rest.users).get()
    const name = get(user, 'data.name')
    const email = get(user, 'data.email')
    const login = get(user, 'data.login')
    return { name, email, login }
  }

  /** @param {CurationPatchEntry[]} patches */
  _isEligibleForMultiversionCuration(patches) {
    return patches.length === 1 && Object.keys(patches[0].revisions).length === 1
  }

  // Return an array of valid patches that exist
  // and a list of definitions that do not exist in the store
  /** @param {CurationPatchEntry[]} patches */
  async _validateDefinitionsExist(patches) {
    const targetCoordinates = patches.reduce((result, patch) => {
      for (const key in patch.revisions)
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

  /** @param {Definition} definition */
  async autoCurate(definition) {
    try {
      if (!this.options.multiversionCurationFeatureFlag) {
        return
      }

      const revisionLessCoordinates = definition.coordinates.asRevisionless()
      const curationAndContributions = /** @type {CurationListResult} */ (await this.list(revisionLessCoordinates))

      if (!this._canBeAutoCurated(definition, curationAndContributions)) {
        this.logger.info('GitHubCurationService.autoCurate.notApplicable', {
          coordinates: definition.coordinates.toString()
        })
        return
      }

      // TODO: Only need to get the clearlydefined tool harvest data. Other tools' harvest data is not necessary.
      const harvest = await this.harvestStore.getAll(definition.coordinates)
      const orderedCoordinates = Object.keys(curationAndContributions.curations || {}).sort((a, b) => {
        const aRevision = EntityCoordinates.fromString(a).revision
        const bRevision = EntityCoordinates.fromString(b).revision
        if (semver.valid(aRevision) && semver.valid(bRevision)) {
          return semver.rcompare(aRevision, bRevision)
        }
        return 0
      })

      for (const coordinateStr of orderedCoordinates) {
        const curation = curationAndContributions.curations[coordinateStr]
        const declaredLicense = get(curation, 'licensed.declared')
        const logProps = {
          source: definition.coordinates.toString(),
          target: coordinateStr
        }
        if (!declaredLicense) {
          this.logger.info('GitHubCurationService.autoCurate.declaredLicenseEmpty', { ...logProps, curation })
          continue
        }

        const otherCoordinates = EntityCoordinates.fromString(coordinateStr)
        const otherDefinition = await this.definitionService.getStored(otherCoordinates)
        if (!otherDefinition) {
          this.logger.info('GitHubCurationService.autoCurate.otherDefinitionEmpty', logProps)
          continue
        }

        const otherHarvest = await this.harvestStore.getAll(otherCoordinates)
        const result = this.licenseMatcher.process(
          { definition, harvest },
          { definition: otherDefinition, harvest: otherHarvest }
        )
        if (result.isMatching) {
          const info = await this._getUserInfo(this.github)
          const resolution = `Auto-generated curation. Newly harvested version ${definition.coordinates.revision} matches existing version ${otherCoordinates.revision}. ${this._generateMatchingDescription(result.match)}`
          const patch = {
            contributionInfo: {
              type: 'auto',
              summary: definition.coordinates.toString(),
              details: `Add ${declaredLicense} license`,
              resolution
            },
            patches: [
              {
                coordinates: revisionLessCoordinates,
                revisions: {
                  [definition.coordinates.revision]: curation
                }
              }
            ]
          }

          const contribution = await this._addOrUpdate(null, this.github, info, patch)
          this.logger.info('GitHubCurationService.autoCurate.match', {
            ...logProps,
            pr: contribution.data.number,
            match: result.match
          })
          return
        }
        this.logger.info('GitHubCurationService.autoCurate.mismatch', {
          ...logProps,
          mismatch: result.mismatch
        })
      }
    } catch (err) {
      this.logger.error('GitHubCurationService.autoCurate.failed', err)
      throw err
    }
  }

  /**
   * @param {Definition} definition
   * @param {CurationListResult} curationAndContributions
   */
  _canBeAutoCurated(definition, curationAndContributions) {
    const tools = get(definition, 'described.tools') || []
    const hasClearlyDefinedInTools = tools.some(tool => tool.startsWith('clearlydefined'))
    const hasCurations =
      curationAndContributions.curations && Object.keys(curationAndContributions.curations).length !== 0
    return hasClearlyDefinedInTools && !this._hasExistingCurations(definition, curationAndContributions) && hasCurations
  }

  /**
   * @param {Definition} definition
   * @param {CurationListResult} curationAndContributions
   */
  _hasExistingCurations(definition, curationAndContributions) {
    const revisions = this._getRevisionsFromCurations(curationAndContributions)
    return revisions.includes(definition.coordinates.revision)
  }

  /**
   * @param {GitHubClient | null} userGithub
   * @param {GitHubClient} serviceGithub
   * @param {ContributionInfo} info
   * @param {CurationPatch} patch
   */
  async addOrUpdate(userGithub, serviceGithub, info, patch) {
    const { missing } = await this._validateDefinitionsExist(patch.patches)
    if (missing.length > 0)
      throw new Error('The contribution has failed because some of the supplied component definitions do not exist')
    return this._addOrUpdate(userGithub, serviceGithub, info, patch)
  }

  /** @param {GitHubPR} pr */
  async addByMergedCuration(pr) {
    try {
      if (!this.options.multiversionCurationFeatureFlag || !pr.merged_at) {
        return undefined
      }
      const patches = /** @type {CurationPatchEntry[]} */ (await this._getPatchesFromMergedPullRequest(pr))

      const component = first(patches)
      const curationRevisions = get(component, 'revisions')
      const revision = first(Object.keys(curationRevisions))
      const curatedCoordinates = EntityCoordinates.fromObject({ ...component.coordinates, revision })

      const { missing } = await this._validateDefinitionsExist(patches)
      if (missing.length > 0) {
        throw new Error('The contribution has failed because some of the supplied component definitions do not exist')
      }
      if (!this._isEligibleForMultiversionCuration(patches)) {
        return undefined
      }
      this.logger.info('eligible component for multiversion curation', { coordinates: curatedCoordinates.toString() })
      let matchingRevisionAndReason = await this._calculateMatchingRevisionAndReason(curatedCoordinates)
      matchingRevisionAndReason = await this._filterRevisionWithDeclaredLicense(
        curatedCoordinates,
        get(curationRevisions, [revision]),
        matchingRevisionAndReason
      )
      if (matchingRevisionAndReason.length === 0) {
        return undefined
      }
      this.logger.info('found additional versions to curate', {
        coordinates: curatedCoordinates.toString(),
        additionalRevisionCount: matchingRevisionAndReason.length
      })
      const info = {
        type: 'auto',
        summary: curatedCoordinates.toString(),
        details: `Add ${get(curationRevisions, [revision, 'licensed', 'declared'])} license`,
        resolution: `Automatically added versions based on ${pr.html_url}\n ${this._formatMultiversionCuratedRevisions(matchingRevisionAndReason)}`
      }
      return this._addCurationWithMatchingRevisions(
        curatedCoordinates,
        curationRevisions[revision],
        info,
        matchingRevisionAndReason
      )
    } catch (err) {
      this.logger.error('GitHubCurationService.addByMergedCuration.addFailed', { error: err, pr: pr.html_url })
      return undefined
    }
  }

  /** @param {GitHubPR} pr */
  async _getPatchesFromMergedPullRequest(pr) {
    const curations = await this.getContributedCurations(pr.number, pr.head.sha)
    const preCurations = await this.getContributedCurations(pr.number, pr.base.sha)
    for (const curation of curations) {
      const preCuration = preCurations.find(x => x.path === curation.path)
      for (const revision of Object.keys(curation.data.revisions)) {
        const current = get(curation, ['data', 'revisions', revision])
        const previous = get(preCuration, ['data', 'revisions', revision])
        // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality to catch both null and undefined
        if (current == undefined || isEqual(current, previous)) {
          unset(curation, ['data', 'revisions', revision])
        }
      }
    }
    return curations.map(c => c.data)
  }

  /**
   * @param {GitHubClient | null} userGithub
   * @param {GitHubClient} serviceGithub
   * @param {GitHubUserInfo} info
   * @param {CurationPatch} patch
   */
  async _addOrUpdate(userGithub, serviceGithub, info, patch) {
    const { owner, repo, branch } = this.options
    const masterBranch = await serviceGithub.rest.repos.getBranch({ owner, repo, branch: `refs/heads/${branch}` })
    const sha = masterBranch.data.commit.sha
    const prBranch = this._getBranchName(info)
    await serviceGithub.rest.git.createRef({ owner, repo, ref: `refs/heads/${prBranch}`, sha })

    await Promise.all(
      // Throat value MUST be kept at 1, otherwise GitHub will write concurrent patches
      patch.patches.map(throat(1, component => this._writePatch(userGithub, serviceGithub, info, component, prBranch)))
    )

    const result = await (userGithub || serviceGithub).rest.pulls.create({
      owner,
      repo,
      title: patch.contributionInfo.summary,
      body: this._generateContributionDescription(patch),
      head: `refs/heads/${prBranch}`,
      base: branch
    })
    const number = result.data.number
    const comment = {
      owner,
      repo,
      issue_number: number,
      body: `You can review the change introduced to the full definition at [ClearlyDefined](${this._getCurationReviewUrl(number)}).`
    }
    await serviceGithub.rest.issues.createComment(comment)
    return result
  }

  /** @param {CurationPatch} patch */
  _generateContributionDescription(patch) {
    const { type, details, summary, resolution } = patch.contributionInfo
    const Type = type.charAt(0).toUpperCase() + type.substr(1)
    return `
**Type:** ${Type}

**Summary:**
${summary}

**Details:**
${details}

**Resolution:**
${resolution}

**Affected definitions**:
${this._formatDefinitions(patch.patches)}`
  }

  /** @param {CurationPatchEntry[]} definitions */
  _formatDefinitions(definitions) {
    return definitions.map(
      def =>
        `- [${def.coordinates.name} ${
          Object.keys(def.revisions)[0]
        }](https://clearlydefined.io/definitions/${EntityCoordinates.fromObject(def.coordinates)}/${
          Object.keys(def.revisions)[0]
        })`
    )
  }

  /** @param {MatchingRevisionAndReason[]} multiversionSearchResults */
  _formatMultiversionCuratedRevisions(multiversionSearchResults) {
    let output = ''
    multiversionSearchResults
      .map(result => result.version)
      .sort((a, b) => {
        if (semver.valid(a) && semver.valid(b)) {
          return semver.compare(a, b)
        }
        return 0
      })
      .forEach(version => (output += `- ${version}\n`))
    const allMatchingProps = union(...multiversionSearchResults.map(m => m.matchingProperties))
    output += this._generateMatchingDescription(allMatchingProps)

    return output
  }

  /** @param {MatchingProperty[]} matchingResults */
  _generateMatchingDescription(matchingResults) {
    let output = ''
    /** @type {string[]} */
    const matchingLicenses = []
    /** @type {Record<string, unknown>} */
    const matchingMetadata = {}
    matchingResults.forEach(match => {
      if (match.file) {
        if (matchingLicenses.indexOf(match.file) === -1) {
          matchingLicenses.push(match.file)
        }
      } else {
        matchingMetadata[match.propPath] = match.value
      }
    })

    if (matchingLicenses.length > 0) {
      output += `\nMatching license file(s): ${matchingLicenses.join(', ')}`
    }

    if (Object.keys(matchingMetadata).length > 0) {
      const metadataText =
        Object.keys(matchingMetadata).length === 1
          ? Object.keys(matchingMetadata).map(
              metadataProp => `${metadataProp}: ${JSON.stringify(matchingMetadata[metadataProp])}`
            )
          : Object.keys(matchingMetadata).map(
              metadataProp => `\n- ${metadataProp}: ${JSON.stringify(matchingMetadata[metadataProp])}`
            )
      output += `\nMatching metadata: ${metadataText}`
    }
    return output
  }

  /**
   * Get the curation for the entity at the given coordinates. If no curation is supplied
   * then look up the standard curation. If the curation is a PR number, get the curation
   * held in that PR. The curation arg might be the actual curation to use. If so, just
   * return it.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for a curation. Must include revision.
   * @param {number | string | CurationRevision | null} [curation] - The curation identifier if any. Could be a PR number,
   * an actual curation object or null.
   * @returns {Promise<CurationRevision | null>} The requested curation revision data, or null
   */
  async get(coordinates, curation = null) {
    if (!coordinates.revision)
      throw new Error(
        `Coordinates ${coordinates.toString()} appear to be malformed. Are they missing a namespace or revision?`
      )
    if (curation && typeof curation !== 'number' && typeof curation !== 'string') return curation
    const all = await this._getCurations(coordinates, /** @type {number | string | null} */ (curation))
    if (!all || !all.revisions) return null
    const result = all.revisions[coordinates.revision]
    if (!result) return null
    // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
    Object.defineProperty(result, '_origin', { value: all._origin, enumerable: false })
    return result
  }

  /**
   * Get the curations for the revisions of the entity at the given coordinates.
   *
   * @param {EntityCoordinates} coordinates - The entity for which we are looking for a curation.
   * @param {number | string | null} [pr] - The curation identifier if any.
   * @returns {Promise<CurationData & { _origin?: { sha: string } } | null>}
   */
  async _getCurations(coordinates, pr = null) {
    const path = this._getCurationPath(coordinates)
    this.logger.debug('7:compute:curation_source:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const tree = await this._getCurationTree(pr)
    this.logger.debug('7:compute:curation_source:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const treePath = flatMap(deCodeSlashes(path).split('/'), (current, i, original) =>
      original.length - 1 !== i ? [current, 'children'] : current
    )
    const blob = get(tree, treePath)
    if (!blob) return null
    this.logger.debug('8:compute:curation_blob:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const data = await this.smartGit.blob(blob.object)
    this.logger.debug('8:compute:curation_blob:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const content = /** @type {CurationData & { _origin?: { sha: string } }} */ (yaml.load(data.toString()))
    // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
    Object.defineProperty(content, '_origin', { value: { sha: blob.object }, enumerable: false })
    return content
  }

  /**
   * get the content for all curations in a given PR
   * @param {*} number - The GitHub PR number
   * @param {*} sha - The GitHub PR head sha
   * @returns {[Curation]} Promise for an array of Curations
   */
  /**
   * @param {number} number
   * @param {string} sha
   */
  async getContributedCurations(number, sha) {
    const prFiles = await this._getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this.isCurationFile)
    const result = await Promise.all(
      curationFilenames.map(
        throat(10, async path => {
          const content = await this._getContent(sha, path)
          if (!content) return undefined
          return new Curation(content, path)
        })
      )
    )
    return result.filter(i => i)
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @param {number | string | CurationRevision | null} curationSpec
   * @param {Definition} definition
   */
  async apply(coordinates, curationSpec, definition) {
    const curation = await this.get(coordinates, curationSpec)
    const result = Curation.apply(definition, curation)
    this._ensureCurationInfo(result, curation)
    return result
  }

  /**
   * @param {Definition} definition
   * @param {CurationRevision} curation
   */
  _ensureCurationInfo(definition, curation) {
    if (!curation) return
    if (Object.getOwnPropertyNames(curation).length === 0) return
    const origin = get(curation, '_origin.sha')
    definition.described = definition.described || {}
    definition.described.tools = definition.described.tools || []
    definition.described.tools.push(`curation/${origin ? origin : 'supplied'}`)
  }

  /**
   * @param {string} ref
   * @param {string} path
   */
  async _getContent(ref, path) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.rest.repos.getContent({ owner, repo, ref, path })
      const data = /** @type {{ content?: string }} */ (response.data)
      if (!data || !data.content) {
        this.logger.info(`No content found for ${owner}/${repo}/${ref}/${path}.`)
        return null
      }
      return Buffer.from(data.content, 'base64').toString('utf8')
    } catch (/** @type {*} */ error) {
      if (error.code === 404) {
        this.logger.info(`The ${owner}/${repo}/${ref}/${path} file is not found.`)
      } else {
        this.logger.info(`Failed to get content for ${owner}/${repo}/${ref}/${path}.`)
      }
      return undefined
    }
  }

  /**
   * @param {string} sha
   * @param {number} number
   * @param {CommitStatusState} state
   * @param {string} description
   */
  async _postCommitStatus(sha, number, state, description) {
    const { owner, repo } = this.options
    const target_url = this._getCurationReviewUrl(number)
    try {
      return this.github.rest.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        description,
        target_url,
        context: 'ClearlyDefined'
      })
    } catch (/** @type {*} */ error) {
      this.logger.info(
        `Failed to create status for PR #${number}. Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`
      )
      return undefined
    }
  }

  /** @param {number} number */
  _getCurationReviewUrl(number) {
    return `${this.endpoints.website}/curations/${number}`
  }

  /**
   * @param {number} number
   * @param {string} body
   */
  async _postErrorsComment(number, body) {
    const { owner, repo } = this.options
    try {
      return this.github.rest.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body
      })
    } catch (/** @type {*} */ error) {
      this.logger.info(`Failed to comment on PR #${number}: ${error}`)
      return undefined
    }
  }

  /**
   * Given partial coordinates, return a list of Curations and Contributions
   * @param {EntityCoordinates} coordinates - the partial coordinates that describe the sort of curation to look for.
   * @returns {Promise<CurationListResult | CurationData[] | null>}
   */
  async list(coordinates) {
    const cacheKey = this._getCacheKey(coordinates)
    const existing = await this.cache.get(cacheKey)
    if (existing) return existing
    const data = await this.store.list(coordinates)
    if (data) await this.cache.set(cacheKey, data, 60 * 60 * 24)
    return data
  }

  /**
   * Return a list of Curations and Contributions for each coordinates provided
   *
   * @param {EntityCoordinates[]} coordinatesList - an array of coordinate paths to list
   * @returns {Promise<Record<string, CurationListResult>>}
   */
  async listAll(coordinatesList) {
    /** @type {Record<string, CurationListResult>} */
    const result = {}
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        const data = await this.list(coordinates)
        if (!data) return
        const key = coordinates.toString()
        result[key] = /** @type {CurationListResult} */ (data)
      })
    )
    await Promise.all(promises)
    return result
  }

  /** @param {number} number */
  getCurationUrl(number) {
    return `https://github.com/${this.options.owner}/${this.options.repo}/pull/${number}`
  }

  // get the list of files changed in the given PR.
  /** @param {number} number */
  async _getPrFiles(number) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.rest.pulls.listFiles({ owner, repo, pull_number: number })
      return response.data
    } catch (/** @type {*} */ error) {
      if (error.code === 404) throw error
      throw new Error(`Error calling GitHub to get pr#${number}. Code ${error.code}`, { cause: error })
    }
  }

  /** @param {number} number */
  async getChangedDefinitions(number) {
    const files = await this._getPrFiles(number)
    /** @type {string[]} */
    const changedCoordinates = []
    for (let i = 0; i < files.length; ++i) {
      const fileName = files[i].filename.replace(/\.yaml$/, '').replace(/^curations\//, '')
      const coordinates = EntityCoordinates.fromString(fileName)
      const prDefinitions = /** @type {{ revisions: Record<string, *> }} */ (
        (await this._getCurations(coordinates, number)) || { revisions: {} }
      )
      const masterDefinitions = /** @type {{ revisions: Record<string, *> }} */ (
        (await this._getCurations(coordinates)) || { revisions: {} }
      )
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

  /** @param {EntityCoordinates} coordinates */
  _getPrTitle(coordinates) {
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return coordinates.toString()
  }

  /** @param {{ login?: string }} info */
  _getBranchName(info) {
    return `${info.login}_${DateTime.now().toFormat('yyMMdd_HHmmss.SSS')}`
  }

  /** @param {EntityCoordinates} coordinates */
  _getCurationPath(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}.yaml`
  }

  /** @param {EntityCoordinates} coordinates */
  _getSearchRoot(coordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}`
  }

  /** @param {string} path */
  isCurationFile(path) {
    return path.startsWith('curations/') && path.endsWith('.yaml')
  }

  /** @param {EntityCoordinates} coordinates */
  _getCacheKey(coordinates) {
    return `cur_${EntityCoordinates.fromObject(coordinates).toString().toLowerCase()}`
  }

  /**
   * @param {EntityCoordinates} coordinates
   * @param {CurationRevision} curation
   * @param {ContributionInfo} info
   * @param {MatchingRevisionAndReason[]} matchingRevisionAndReason
   */
  async _addCurationWithMatchingRevisions(coordinates, curation, info, matchingRevisionAndReason) {
    const license = get(curation, 'licensed.declared')
    if (!license) {
      return undefined
    }
    /** @type {Record<string, CurationRevision>} */
    /** @type {Record<string, CurationRevision>} */
    const newRevisions = {}
    matchingRevisionAndReason.forEach(versionAndReason => {
      newRevisions[versionAndReason.version] = { licensed: { declared: license } }
    })
    const userInfo = await this._getUserInfo(this.github)
    const patch = {
      contributionInfo: info,
      patches: [
        {
          coordinates: coordinates.asRevisionless(),
          revisions: newRevisions
        }
      ]
    }
    return this._addOrUpdate(null, this.github, userInfo, patch)
  }

  /** @param {EntityCoordinates[]} coordinatesList */
  async reprocessMergedCurations(coordinatesList) {
    const uniqueCoordinatesList = uniqWith(
      coordinatesList,
      (a, b) => a.type === b.type && a.provider === b.provider && a.namespace === b.namespace && a.name === b.name
    )
    /** @type {{ coordinates: string, contributions?: *, error?: string }[]} */
    const results = []
    for (const coordinates of uniqueCoordinatesList) {
      /** @type {{ coordinates: string, contributions?: *, error?: string }} */
      const result = { coordinates: coordinates.toString() }
      try {
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationStart', {
          coordinate: coordinates.toString()
        })
        result.contributions = await this._reprocessMergedCuration(coordinates)
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationSuccess', {
          coordinate: coordinates.toString()
        })
      } catch (/** @type {*} */ err) {
        result.error = err.message
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationFailed', {
          err,
          coordinate: coordinates.toString()
        })
      }
      results.push(result)
    }
    return results
  }

  /** @param {EntityCoordinates} coordinates */
  async _reprocessMergedCuration(coordinates) {
    const contributions = []
    coordinates = coordinates.asRevisionless()
    const { curations } = /** @type {CurationListResult} */ (await this.list(coordinates))
    if (!curations || Object.keys(curations).length === 0) return undefined
    const processedRevisions = new Set()
    for (const [curatedCoordinatesStr, curation] of Object.entries(curations)) {
      const curatedCoordinates = EntityCoordinates.fromString(curatedCoordinatesStr)
      let matchingRevisionAndReason = await this._calculateMatchingRevisionAndReason(curatedCoordinates)
      matchingRevisionAndReason = matchingRevisionAndReason.filter(r => !processedRevisions.has(r.version))
      matchingRevisionAndReason = await this._filterRevisionWithDeclaredLicense(
        curatedCoordinates,
        curation,
        matchingRevisionAndReason
      )
      if (matchingRevisionAndReason.length === 0) {
        contributions.push({ coordinates: curatedCoordinates.toString() })
        continue
      }
      this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessSingleRevisionStart', {
        coordinate: curatedCoordinates.toString(),
        additionalRevisionCount: matchingRevisionAndReason.length
      })
      const info = {
        type: 'auto',
        summary: `Reprocess merged curation for ${EntityCoordinates.fromObject(curatedCoordinates).toString()}`,
        details: `Curated ${get(curation, ['licensed.declared'])} license`,
        resolution: `Automatically added versions based on merged curation:\n ${this._formatMultiversionCuratedRevisions(matchingRevisionAndReason)}`
      }
      const contribution = await this._addCurationWithMatchingRevisions(
        curatedCoordinates,
        curation,
        info,
        matchingRevisionAndReason
      )
      matchingRevisionAndReason.forEach(r => processedRevisions.add(r.version))
      contributions.push({
        coordinates: curatedCoordinates.toString(),
        contribution: get(contribution, 'data.html_url')
      })
    }
    return contributions
  }

  /** @param {{ owner: string, repo: string }} options */
  _initSmartGit({ owner, repo }) {
    return geit(`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`)
  }

  /** @param {number | string | null} [pr] */
  async _getCurationTree(pr) {
    const key = this._generateCurationTreeKey(pr)
    const cached = this.treeCache.get(key)
    if (cached) return cached
    const tree = await this.smartGit.tree(pr ? `refs/pull/${encodeURIComponent(pr)}/head` : this.options.branch)
    // Since these trees are used very often and not changed frequently, it should be cached but not be kept in Redis.
    // In case webhook event failed to trigger cache clean, set ttl to a day
    this.treeCache.put(key, tree, 4 * hourInMS)
    return tree
  }

  /** @param {number | string | null} [pr] */
  _cleanCurationTree(pr) {
    const key = this._generateCurationTreeKey(pr)
    this.treeCache.del(key)
  }

  /** @param {number | string | null} [pr] */
  _generateCurationTreeKey(pr) {
    return pr ? `refs/pull/${encodeURIComponent(pr)}/head` : this.options.branch
  }
}

module.exports =
  /**
   * @param {GitHubCurationOptions} options
   * @param {ICurationStore} store
   * @param {Endpoints} endpoints
   * @param {CurationDefinitionService} definition
   * @param {ICache} cache
   * @param {CurationHarvestStore} harvestService
   * @param {LicenseMatcher} [licenseMatcher]
   */
  (options, store, endpoints, definition, cache, harvestService, licenseMatcher) =>
    new GitHubCurationService(options, store, endpoints, definition, cache, harvestService, licenseMatcher)
