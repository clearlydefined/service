// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { CurationData, CurationRevision } from '../../lib/curation.ts'
import type { GitHubClient } from '../../lib/github.ts'
import type { Definition } from '../../lib/utils.ts'
import type { ICache } from '../caching/index.js'
import type { Logger } from '../logging/index.js'
import type {
  ContributionInfo,
  CurationDefinitionService,
  CurationHarvestStore,
  CurationListResult,
  CurationPatch,
  CurationPatchEntry,
  Endpoints,
  GitHubCurationOptions,
  GitHubPR,
  ICurationStore,
  MatchingProperty,
  MatchingRevisionAndReason
} from './index.js'

/** User info returned from the GitHub API */
export interface GitHubUserInfo {
  name?: string | null
  email?: string | null
  login?: string | null
}

/** GitHub commit status state values */
export type CommitStatusState = 'error' | 'failure' | 'pending' | 'success'

import lodash from 'lodash'

const { concat, get, forIn, merge, isEqual, uniq, pick, flatten, flatMap, first, union, unset, uniqWith } = lodash

import geit from 'geit'
import yaml from 'js-yaml'
import { DateTime } from 'luxon'
import throat from 'throat'
import tmp from 'tmp'
import Curation from '../../lib/curation.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'
import * as Github from '../../lib/github.ts'

tmp.setGracefulCleanup()

import type { CacheClass } from 'memory-cache'
import { Cache } from 'memory-cache'
import semver from 'semver'
import { LicenseMatcher } from '../../lib/licenseMatcher.ts'
import { deCodeSlashes } from '../../lib/utils.ts'
import logger from '../logging/logger.ts'

const hourInMS = 60 * 60 * 1000

// Responsible for managing curation patches in a store
//
// TODO:
// Validate the schema of the curation patch
class GitHubCurationService {
  declare logger: Logger
  declare options: GitHubCurationOptions
  declare store: ICurationStore
  declare endpoints: Endpoints
  declare definitionService: CurationDefinitionService
  declare curationUpdateTime: Date | null
  declare tempLocation: string | null
  declare github: GitHubClient
  declare cache: ICache
  declare harvestStore: CurationHarvestStore
  declare licenseMatcher: LicenseMatcher
  declare smartGit: ReturnType<typeof geit>
  declare treeCache: CacheClass<string, unknown>

  constructor(
    options: GitHubCurationOptions,
    store: ICurationStore,
    endpoints: Endpoints,
    definition: CurationDefinitionService,
    cache: ICache,
    harvestStore: CurationHarvestStore,
    licenseMatcher?: LicenseMatcher
  ) {
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
  async syncAllContributions(client: GitHubClient) {
    const states: string[] = ['open', 'closed']
    for (const state of states) {
      let prOptions: Record<string, unknown> = {
        owner: this.options.owner,
        repo: this.options.repo,
        per_page: 100,
        state
      }
      //See https://docs.github.com/en/rest/reference/pulls#list-pull-requests
      if (state === 'closed') {
        prOptions = { ...prOptions, sort: 'updated', direction: 'asc' }
      }
      // @ts-expect-error legacy GitHub client API
      let response = await client.pullRequests.getAll(prOptions)
      this._processContributions(response.data)
      // @ts-expect-error legacy GitHub client API
      while (this.github.hasNextPage(response)) {
        // @ts-expect-error legacy GitHub client API
        response = await this.github.getNextPage(response)
        this._processContributions(response.data)
      }
    }
  }

  async _processContributions(prs: GitHubPR[]) {
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
   * @param pr - The GitHub PR object
   * @param curations - Optional. The contributed curations for this PR
   * @returns Promise indicating the operation is complete.
   */
  async updateContribution(pr: GitHubPR, curations: Curation[] | null = null) {
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
    let toBeCleaned = flatten(curations!.map(curation => curation.getCoordinates()))
    // Should also delete revision less coordinate curation cache
    toBeCleaned = uniqWith(toBeCleaned.concat(toBeCleaned.map(c => c.asRevisionless())), isEqual)
    await Promise.all(
      toBeCleaned.map(throat(10, async coordinates => this.cache.delete(this._getCacheKey(coordinates))))
    )
    if (data.merged_at) {
      await this._prMerged(curations!)
    }
  }

  /**
   * Process the fact that the given PR has been merged by persisting the curation and invalidating the definition
   * @param curations - The set of actual proposed changes
   */
  async _prMerged(curations: Curation[]): Promise<(void | Definition)[]> {
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
            .catch((error: unknown) => this.logger.info(`Failed to compute/store ${coordinates.toString()}: ${error}`))
        })
      )
    )
  }

  async validateContributions(number: number, sha: string, curations: Curation[]) {
    await this._postCommitStatus(sha, number, 'pending', 'Validation in progress')
    const invalidCurations = curations.filter(x => !x.isValid)
    let state: CommitStatusState = 'success'
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

  async _startMatching(coordinates: EntityCoordinates, otherCoordinatesList: EntityCoordinates[]) {
    const definition = await this.definitionService.getStored(coordinates)
    const harvest = await this.harvestStore.getAll(coordinates)
    const matches: MatchingRevisionAndReason[] = []

    await Promise.all(
      otherCoordinatesList.map(async otherCoordinates => {
        const otherDefinition = await this.definitionService.getStored(otherCoordinates)
        const otherHarvest = await this.harvestStore.getAll(otherCoordinates)
        const result = this.licenseMatcher.process(
          { definition: definition!, harvest },
          { definition: otherDefinition!, harvest: otherHarvest }
        )

        if (result.isMatching) {
          matches.push({
            version: otherCoordinates.revision!,
            matchingProperties: result.match!.map(reason => {
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

  _getRevisionsFromCurations(curations: CurationListResult) {
    let revisions: string[] = []

    for (const coordinate of Object.keys(curations.curations)) {
      const coordinateObject = EntityCoordinates.fromString(coordinate)!
      revisions.push(coordinateObject.revision!)
    }

    for (const contribution of curations.contributions) {
      // @ts-expect-error files may be array or record depending on store
      for (const file of contribution.files) {
        const fileRevisions = get(file, 'revisions', {}).map((/** @type {*} */ revision) => revision.revision)
        revisions = union(revisions, fileRevisions)
      }
    }

    return revisions
  }

  async _calculateMatchingRevisionAndReason(coordinates: EntityCoordinates) {
    const revisionlessCoords = coordinates.asRevisionless()
    const coordinatesList = await this.definitionService.list(revisionlessCoords)
    const filteredCoordinatesList = coordinatesList
      .map(stringCoords => EntityCoordinates.fromString(stringCoords)!)
      .filter(
        coords =>
          coordinates.name === coords.name &&
          coordinates.revision !== coords.revision &&
          coords.revision !== 'undefined'
      )

    const matchingRevisionsAndReasons = await this._startMatching(coordinates, filteredCoordinatesList)
    // @ts-expect-error list returns CurationListResult for GitHubCurationService
    const curations: CurationListResult = await this.list(revisionlessCoords)
    const existingRevisions = this._getRevisionsFromCurations(curations)
    const uncuratedMatchingRevisions = matchingRevisionsAndReasons.filter(
      versionAndReason => existingRevisions.indexOf(versionAndReason.version) === -1
    )
    return uncuratedMatchingRevisions
  }

  async _filterRevisionWithDeclaredLicense(
    coordinates: EntityCoordinates,
    curation: CurationRevision,
    matchingRevisionAndReason: MatchingRevisionAndReason[]
  ) {
    const filtered: MatchingRevisionAndReason[] = []
    for (const revisionAndReason of matchingRevisionAndReason) {
      const { version } = revisionAndReason
      const matchingCoordinates = EntityCoordinates.fromObject({ ...coordinates, revision: version })!
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

  _updateContent(
    coordinates: EntityCoordinates,
    currentContent: CurationData,
    newContent: Record<string, CurationRevision>
  ) {
    const newCoordinates = EntityCoordinates.fromObject(coordinates)!.asRevisionless()
    const result = {
      coordinates: newCoordinates,
      revisions: get(currentContent, 'revisions') || {}
    }
    forIn(newContent, (value, key) => (result.revisions[key] = merge(result.revisions[key] || {}, value)))
    return yaml.dump(result, { sortKeys: true, lineWidth: 150 })
  }

  async _writePatch(
    userGithub: GitHubClient | null,
    serviceGithub: GitHubClient,
    info: GitHubUserInfo,
    patch: CurationPatchEntry,
    branch: string
  ) {
    const { owner, repo } = this.options
    const coordinates = EntityCoordinates.fromObject(patch.coordinates)!
    const currentContent = await this._getCurations(coordinates)
    const newContent = patch.revisions
    const updatedContent = this._updateContent(coordinates, currentContent!, newContent)
    const content = Buffer.from(updatedContent).toString('base64')
    const path = this._getCurationPath(coordinates)
    const message = `Update ${path}`
    const fileBody: {
      owner: string
      repo: string
      path: string
      message: string
      content: string
      branch: string
      committer?: { name: string; email: string }
      sha?: string
    } = {
      owner,
      repo,
      path,
      message,
      content,
      branch
    }

    if (userGithub) {
      const { name, email } = await this._getUserInfo(userGithub)
      if (name && email) {
        fileBody.committer = { name, email }
      }
    }

    // Github requires name/email to set committer
    if ((info.name || info.login) && info.email) {
      fileBody.committer = { name: (info.name || info.login)!, email: info.email }
    }
    if (get(currentContent, '_origin.sha')) {
      fileBody.sha = get(currentContent, '_origin.sha')
      return serviceGithub.rest.repos.createOrUpdateFileContents(fileBody)
    }
    return serviceGithub.rest.repos.createOrUpdateFileContents(fileBody)
  }

  async _getUserInfo(githubCli: GitHubClient) {
    // @ts-expect-error legacy GitHub client API shape
    const user = await githubCli.rest.users.get()
    const name = get(user, 'data.name')
    const email = get(user, 'data.email')
    const login = get(user, 'data.login')
    return { name, email, login }
  }

  _isEligibleForMultiversionCuration(patches: CurationPatchEntry[]) {
    return patches.length === 1 && Object.keys(patches[0].revisions).length === 1
  }

  // Return an array of valid patches that exist
  // and a list of definitions that do not exist in the store
  async _validateDefinitionsExist(patches: CurationPatchEntry[]) {
    const targetCoordinates = patches.reduce((result: EntityCoordinates[], patch) => {
      for (const key in patch.revisions) {
        result.push(EntityCoordinates.fromObject({ ...patch.coordinates, revision: key })!)
      }
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
      { valid: [] as EntityCoordinates[], missing: [] as EntityCoordinates[] }
    )
  }

  async autoCurate(definition: Definition) {
    try {
      if (!this.options.multiversionCurationFeatureFlag) {
        return
      }

      const revisionLessCoordinates = definition.coordinates!.asRevisionless()
      // @ts-expect-error list returns CurationListResult for GitHubCurationService
      const curationAndContributions: CurationListResult = await this.list(revisionLessCoordinates)

      if (!this._canBeAutoCurated(definition, curationAndContributions)) {
        this.logger.info('GitHubCurationService.autoCurate.notApplicable', {
          coordinates: definition.coordinates!.toString()
        })
        return
      }

      // TODO: Only need to get the clearlydefined tool harvest data. Other tools' harvest data is not necessary.
      const harvest = await this.harvestStore.getAll(definition.coordinates!)
      const orderedCoordinates = Object.keys(curationAndContributions.curations || {}).sort((a, b) => {
        const aRevision = EntityCoordinates.fromString(a)!.revision
        const bRevision = EntityCoordinates.fromString(b)!.revision
        if (semver.valid(aRevision) && semver.valid(bRevision)) {
          return semver.rcompare(aRevision!, bRevision!)
        }
        return 0
      })

      for (const coordinateStr of orderedCoordinates) {
        const curation = curationAndContributions.curations[coordinateStr]
        const declaredLicense = get(curation, 'licensed.declared')
        const logProps = {
          source: definition.coordinates!.toString(),
          target: coordinateStr
        }
        if (!declaredLicense) {
          this.logger.info('GitHubCurationService.autoCurate.declaredLicenseEmpty', { ...logProps, curation })
          continue
        }

        const otherCoordinates = EntityCoordinates.fromString(coordinateStr)!
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
          const resolution = `Auto-generated curation. Newly harvested version ${definition.coordinates!.revision} matches existing version ${otherCoordinates.revision}. ${this._generateMatchingDescription(result.match!)}`
          const patch = {
            contributionInfo: {
              type: 'auto',
              summary: definition.coordinates!.toString(),
              details: `Add ${declaredLicense} license`,
              resolution
            },
            patches: [
              {
                coordinates: revisionLessCoordinates,
                revisions: {
                  [definition.coordinates!.revision!]: curation
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

  _canBeAutoCurated(definition: Definition, curationAndContributions: CurationListResult) {
    const tools = get(definition, 'described.tools') || []
    const hasClearlyDefinedInTools = tools.some(tool => tool.startsWith('clearlydefined'))
    const hasCurations =
      curationAndContributions.curations && Object.keys(curationAndContributions.curations).length !== 0
    return hasClearlyDefinedInTools && !this._hasExistingCurations(definition, curationAndContributions) && hasCurations
  }

  _hasExistingCurations(definition: Definition, curationAndContributions: CurationListResult) {
    const revisions = this._getRevisionsFromCurations(curationAndContributions)
    return revisions.includes(definition.coordinates!.revision!)
  }

  async addOrUpdate(
    userGithub: GitHubClient | null,
    serviceGithub: GitHubClient,
    info: ContributionInfo,
    patch: CurationPatch
  ) {
    const { missing } = await this._validateDefinitionsExist(patch.patches)
    if (missing.length > 0) {
      throw new Error('The contribution has failed because some of the supplied component definitions do not exist')
    }
    return this._addOrUpdate(userGithub, serviceGithub, info, patch)
  }

  async addByMergedCuration(pr: GitHubPR) {
    try {
      if (!this.options.multiversionCurationFeatureFlag || !pr.merged_at) {
        return undefined
      }
      // @ts-expect-error patches returned from _getPatchesFromMergedPullRequest match CurationPatchEntry shape
      const patches: CurationPatchEntry[] = await this._getPatchesFromMergedPullRequest(pr)
      const component = first(patches)!
      const curationRevisions = get(component, 'revisions')!
      const revision = first(Object.keys(curationRevisions))
      const curatedCoordinates = EntityCoordinates.fromObject({ ...component.coordinates, revision })!

      const { missing } = await this._validateDefinitionsExist(patches)
      if (missing.length > 0) {
        throw new Error('The contribution has failed because some of the supplied component definitions do not exist')
      }
      if (!this._isEligibleForMultiversionCuration(patches)) {
        return undefined
      }
      this.logger.info('eligible component for multiversion curation', { coordinates: curatedCoordinates!.toString() })
      let matchingRevisionAndReason = await this._calculateMatchingRevisionAndReason(curatedCoordinates)
      matchingRevisionAndReason = await this._filterRevisionWithDeclaredLicense(
        curatedCoordinates!,
        get(curationRevisions, [revision!]),
        matchingRevisionAndReason
      )
      if (matchingRevisionAndReason.length === 0) {
        return undefined
      }
      this.logger.info('found additional versions to curate', {
        coordinates: curatedCoordinates!.toString(),
        additionalRevisionCount: matchingRevisionAndReason.length
      })
      const info = {
        type: 'auto',
        summary: curatedCoordinates!.toString(),
        details: `Add ${get(curationRevisions, [revision!, 'licensed', 'declared'])} license`,
        resolution: `Automatically added versions based on ${pr.html_url}\n ${this._formatMultiversionCuratedRevisions(matchingRevisionAndReason)}`
      }
      return this._addCurationWithMatchingRevisions(
        curatedCoordinates!,
        curationRevisions[revision!],
        info,
        matchingRevisionAndReason
      )
    } catch (err) {
      this.logger.error('GitHubCurationService.addByMergedCuration.addFailed', { error: err, pr: pr.html_url })
      return undefined
    }
  }

  async _getPatchesFromMergedPullRequest(pr: GitHubPR) {
    const curations = await this.getContributedCurations(pr.number, pr.head.sha)
    const preCurations = await this.getContributedCurations(pr.number, pr.base.sha)
    for (const curation of curations) {
      const preCuration = preCurations.find(x => x!.path === curation!.path)
      for (const revision of Object.keys(curation!.data!.revisions!)) {
        const current = get(curation, ['data', 'revisions', revision])
        const previous = get(preCuration, ['data', 'revisions', revision])
        // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality to catch both null and undefined
        if (current == undefined || isEqual(current, previous)) {
          unset(curation, ['data', 'revisions', revision])
        }
      }
    }
    return curations.map(c => c!.data!)
  }

  async _addOrUpdate(
    userGithub: GitHubClient | null,
    serviceGithub: GitHubClient,
    info: GitHubUserInfo,
    patch: CurationPatch
  ) {
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

  _generateContributionDescription(patch: CurationPatch) {
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

  _formatDefinitions(definitions: CurationPatchEntry[]) {
    return definitions.map(
      def =>
        `- [${def.coordinates.name} ${
          Object.keys(def.revisions)[0]
        }](https://clearlydefined.io/definitions/${EntityCoordinates.fromObject(def.coordinates)}/${
          Object.keys(def.revisions)[0]
        })`
    )
  }

  _formatMultiversionCuratedRevisions(multiversionSearchResults: MatchingRevisionAndReason[]) {
    let output = ''
    const sortedVersions = multiversionSearchResults
      .map(result => result.version)
      .sort((a, b) => {
        if (semver.valid(a) && semver.valid(b)) {
          return semver.compare(a, b)
        }
        return 0
      })
    for (const version of sortedVersions) {
      output += `- ${version}\n`
    }
    const allMatchingProps = union(...multiversionSearchResults.map(m => m.matchingProperties))
    output += this._generateMatchingDescription(allMatchingProps)

    return output
  }

  _generateMatchingDescription(matchingResults: MatchingProperty[]) {
    let output = ''
    const matchingLicenses: string[] = []
    const matchingMetadata: Record<string, unknown> = {}
    for (const match of matchingResults) {
      if (match.file) {
        if (matchingLicenses.indexOf(match.file) === -1) {
          matchingLicenses.push(match.file)
        }
      } else {
        matchingMetadata[match.propPath!] = match.value
      }
    }

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
   * @param coordinates - The entity for which we are looking for a curation. Must include revision.
   * @param curation - The curation identifier if any. Could be a PR number,
   * an actual curation object or null.
   */
  async get(
    coordinates: EntityCoordinates,
    curation: number | string | CurationRevision | null = null
  ): Promise<CurationRevision | null> {
    if (!coordinates.revision) {
      throw new Error(
        `Coordinates ${coordinates.toString()} appear to be malformed. Are they missing a namespace or revision?`
      )
    }
    if (curation && typeof curation !== 'number' && typeof curation !== 'string') {
      return curation
    }
    const prId = typeof curation === 'number' || typeof curation === 'string' ? curation : null
    const all = await this._getCurations(coordinates, prId)
    if (!all?.revisions) {
      return null
    }
    const result = all.revisions[coordinates.revision]
    if (!result) {
      return null
    }
    // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
    Object.defineProperty(result, '_origin', { value: all._origin, enumerable: false })
    return result
  }

  /**
   * Get the curations for the revisions of the entity at the given coordinates.
   *
   * @param coordinates - The entity for which we are looking for a curation.
   * @param pr - The curation identifier if any.
   */
  async _getCurations(
    coordinates: EntityCoordinates,
    pr: number | string | null = null
  ): Promise<(CurationData & { _origin?: { sha: string } }) | null> {
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
    if (!blob) {
      return null
    }
    this.logger.debug('8:compute:curation_blob:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const data = await this.smartGit.blob(blob.object)
    this.logger.debug('8:compute:curation_blob:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const content: CurationData & { _origin?: { sha: string } } = yaml.load(data.toString()) as CurationData & { _origin?: { sha: string } }
    // Stash the sha of the content as a NON-enumerable prop so it does not get merged into the patch
    Object.defineProperty(content, '_origin', { value: { sha: blob.object }, enumerable: false })
    return content
  }

  /**
   * get the content for all curations in a given PR
   * @param number - The GitHub PR number
   * @param sha - The GitHub PR head sha
   * @returns Promise for an array of Curations
   */
  async getContributedCurations(number: number, sha: string) {
    const prFiles = await this._getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this.isCurationFile)
    const result = await Promise.all(
      curationFilenames.map(
        throat(10, async path => {
          const content = await this._getContent(sha, path)
          if (!content) {
            return undefined
          }
          return new Curation(content, path)
        })
      )
    )
    return result.filter((i): i is Curation => !!i)
  }

  async apply(
    coordinates: EntityCoordinates,
    curationSpec: number | string | CurationRevision | null,
    definition: Definition
  ) {
    const curation = await this.get(coordinates, curationSpec)
    const result = Curation.apply(definition, curation!)
    this._ensureCurationInfo(result, curation!)
    return result
  }

  _ensureCurationInfo(definition: Definition, curation: CurationRevision) {
    if (!curation) {
      return
    }
    if (Object.getOwnPropertyNames(curation).length === 0) {
      return
    }
    const origin = get(curation, '_origin.sha')
    definition.described = definition.described || {}
    definition.described.tools = definition.described.tools || []
    definition.described.tools.push(`curation/${origin ? origin : 'supplied'}`)
  }

  async _getContent(ref: string, path: string) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.rest.repos.getContent({ owner, repo, ref, path })
      // @ts-expect-error response.data may be a file object with content
      const content: string | undefined = response.data?.content
      if (!content) {
        this.logger.info(`No content found for ${owner}/${repo}/${ref}/${path}.`)
        return null
      }
      return Buffer.from(content, 'base64').toString('utf8')
    } catch (error: unknown) {
      // @ts-expect-error error may have code property
      if (error.code === 404) {
        this.logger.info(`The ${owner}/${repo}/${ref}/${path} file is not found.`)
      } else {
        this.logger.info(`Failed to get content for ${owner}/${repo}/${ref}/${path}.`)
      }
      return undefined
    }
  }

  async _postCommitStatus(sha: string, number: number, state: CommitStatusState, description: string) {
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
    } catch (error: unknown) {
      this.logger.info(
        `Failed to create status for PR #${number}. Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`
      )
      return undefined
    }
  }

  _getCurationReviewUrl(number: number) {
    return `${this.endpoints.website}/curations/${number}`
  }

  async _postErrorsComment(number: number, body: string) {
    const { owner, repo } = this.options
    try {
      return this.github.rest.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body
      })
    } catch (error: unknown) {
      this.logger.info(`Failed to comment on PR #${number}: ${error}`)
      return undefined
    }
  }

  /**
   * Given partial coordinates, return a list of Curations and Contributions
   * @param coordinates - the partial coordinates that describe the sort of curation to look for.
   */
  async list(coordinates: EntityCoordinates): Promise<CurationListResult | CurationData[] | null> {
    const cacheKey = this._getCacheKey(coordinates)
    const existing = await this.cache.get(cacheKey)
    if (existing) {
      return existing
    }
    const data = await this.store.list(coordinates)
    if (data) {
      await this.cache.set(cacheKey, data, 60 * 60 * 24)
    }
    return data
  }

  /**
   * Return a list of Curations and Contributions for each coordinates provided
   *
   * @param coordinatesList - an array of coordinate paths to list
   */
  async listAll(coordinatesList: EntityCoordinates[]): Promise<Record<string, CurationListResult>> {
    const result: Record<string, CurationListResult> = {}
    const promises = coordinatesList.map(
      throat(10, async coordinates => {
        const data = await this.list(coordinates)
        if (!data) {
          return
        }
        const key = coordinates.toString()
        // @ts-expect-error list returns CurationListResult for GitHubCurationService
        result[key] = data
      })
    )
    await Promise.all(promises)
    return result
  }

  getCurationUrl(number: number) {
    return `https://github.com/${this.options.owner}/${this.options.repo}/pull/${number}`
  }

  // get the list of files changed in the given PR.
  async _getPrFiles(number: number) {
    const { owner, repo } = this.options
    try {
      const response = await this.github.rest.pulls.listFiles({ owner, repo, pull_number: number })
      return response.data
    } catch (error: unknown) {
      // @ts-expect-error error may have code property
      if (error.code === 404) {
        throw error
      }
      // @ts-expect-error error may have code property
      throw new Error(`Error calling GitHub to get pr#${number}. Code ${error.code}`, { cause: error })
    }
  }

  async getChangedDefinitions(number: number) {
    const files = await this._getPrFiles(number)
    const changedCoordinates: string[] = []
    for (let i = 0; i < files.length; ++i) {
      const fileName = files[i].filename.replace(/\.yaml$/, '').replace(/^curations\//, '')
      const coordinates = EntityCoordinates.fromString(fileName)!
      const prDefinitions = (await this._getCurations(coordinates, number)) || { revisions: {} }
      const masterDefinitions = (await this._getCurations(coordinates)) || { revisions: {} }
      const allUnfilteredRevisions = concat(
        Object.keys(prDefinitions.revisions!),
        Object.keys(masterDefinitions.revisions!)
      )
      const allRevisions = uniq(allUnfilteredRevisions)
      const changedRevisions = allRevisions.filter(
        revision => !isEqual(prDefinitions.revisions![revision], masterDefinitions.revisions![revision])
      )
      for (const revision of changedRevisions) {
        changedCoordinates.push(`${fileName}/${revision}`)
      }
    }
    return changedCoordinates
  }

  _getPrTitle(coordinates: EntityCoordinates) {
    // Structure the PR title to match the entity coordinates so we can hackily reverse engineer that to build a URL... :-/
    return coordinates.toString()
  }

  _getBranchName(info: { login?: string | null }) {
    return `${info.login}_${DateTime.now().toFormat('yyMMdd_HHmmss.SSS')}`
  }

  _getCurationPath(coordinates: EntityCoordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}.yaml`
  }

  _getSearchRoot(coordinates: EntityCoordinates) {
    const path = coordinates.asRevisionless().toString()
    return `curations/${path}`
  }

  isCurationFile(path: string) {
    return path.startsWith('curations/') && path.endsWith('.yaml')
  }

  _getCacheKey(coordinates: EntityCoordinates) {
    return `cur_${EntityCoordinates.fromObject(coordinates)!.toString().toLowerCase()}`
  }

  async _addCurationWithMatchingRevisions(
    coordinates: EntityCoordinates,
    curation: CurationRevision,
    info: ContributionInfo,
    matchingRevisionAndReason: MatchingRevisionAndReason[]
  ) {
    const license = get(curation, 'licensed.declared')
    if (!license) {
      return undefined
    }
    const newRevisions: Record<string, CurationRevision> = {}
    for (const versionAndReason of matchingRevisionAndReason) {
      newRevisions[versionAndReason.version] = { licensed: { declared: license } }
    }
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

  async reprocessMergedCurations(coordinatesList: EntityCoordinates[]) {
    const uniqueCoordinatesList = uniqWith(
      coordinatesList,
      (a, b) => a.type === b.type && a.provider === b.provider && a.namespace === b.namespace && a.name === b.name
    )
    const results: { coordinates: string; contributions?: unknown; error?: string }[] = []
    for (const coordinates of uniqueCoordinatesList) {
      const result: { coordinates: string; contributions?: unknown; error?: string } = {
        coordinates: coordinates.toString()
      }
      try {
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationStart', {
          coordinate: coordinates.toString()
        })
        result.contributions = await this._reprocessMergedCuration(coordinates)
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationSuccess', {
          coordinate: coordinates.toString()
        })
      } catch (err: unknown) {
        result.error = err instanceof Error ? err.message : String(err)
        this.logger.info('GitHubCurationService.reprocessMergedCurations.reprocessMergedCurationFailed', {
          err,
          coordinate: coordinates.toString()
        })
      }
      results.push(result)
    }
    return results
  }

  async _reprocessMergedCuration(coordinates: EntityCoordinates) {
    const contributions: { coordinates: string; contribution?: string }[] = []
    coordinates = coordinates.asRevisionless()
    // @ts-expect-error list returns CurationListResult for GitHubCurationService
    const { curations } = await this.list(coordinates)
    if (!curations || Object.keys(curations).length === 0) {
      return undefined
    }
    const processedRevisions = new Set()
    for (const [curatedCoordinatesStr, curation] of Object.entries(curations)) {
      const curatedCoordinates = EntityCoordinates.fromString(curatedCoordinatesStr)!
      let matchingRevisionAndReason = await this._calculateMatchingRevisionAndReason(curatedCoordinates)
      matchingRevisionAndReason = matchingRevisionAndReason.filter(r => !processedRevisions.has(r.version))
      matchingRevisionAndReason = await this._filterRevisionWithDeclaredLicense(
        curatedCoordinates,
        curation as CurationRevision,
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
        summary: `Reprocess merged curation for ${EntityCoordinates.fromObject(curatedCoordinates)!.toString()}`,
        details: `Curated ${get(curation, ['licensed.declared'])} license`,
        resolution: `Automatically added versions based on merged curation:\n ${this._formatMultiversionCuratedRevisions(matchingRevisionAndReason)}`
      }
      const contribution = await this._addCurationWithMatchingRevisions(
        curatedCoordinates,
        curation as CurationRevision,
        info,
        matchingRevisionAndReason
      )
      for (const r of matchingRevisionAndReason) {
        processedRevisions.add(r.version)
      }
      contributions.push({
        coordinates: curatedCoordinates!.toString(),
        contribution: get(contribution, 'data.html_url')
      })
    }
    return contributions
  }

  _initSmartGit({ owner, repo }: { owner: string; repo: string }) {
    return geit(`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`)
  }

  async _getCurationTree(pr?: number | string | null) {
    const key = this._generateCurationTreeKey(pr)
    const cached = this.treeCache.get(key)
    if (cached) {
      return cached
    }
    const tree = await this.smartGit.tree(pr ? `refs/pull/${encodeURIComponent(pr)}/head` : this.options.branch)
    // Since these trees are used very often and not changed frequently, it should be cached but not be kept in Redis.
    // In case webhook event failed to trigger cache clean, set ttl to a day
    this.treeCache.put(key, tree, 4 * hourInMS)
    return tree
  }

  _cleanCurationTree(pr?: number | string | null) {
    const key = this._generateCurationTreeKey(pr)
    this.treeCache.del(key)
  }

  _generateCurationTreeKey(pr?: number | string | null) {
    return pr ? `refs/pull/${encodeURIComponent(pr)}/head` : this.options.branch
  }
}

export default (
  options: GitHubCurationOptions,
  store: ICurationStore,
  endpoints: Endpoints,
  definition: CurationDefinitionService,
  cache: ICache,
  harvestService: CurationHarvestStore,
  licenseMatcher?: LicenseMatcher
) => new GitHubCurationService(options, store, endpoints, definition, cache, harvestService, licenseMatcher)
