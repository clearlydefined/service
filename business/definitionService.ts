// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { SpdxExpression } from '@clearlydefined/spdx'
import type { ICache } from '../providers/caching/index.js'
import type { Logger } from '../providers/logging/index.js'

import lodash from 'lodash'
import throat from 'throat'

const {
  get,
  set,
  sortedUniq,
  omit,
  remove,
  pullAllWith,
  isEqual,
  uniqWith,
  flatten,
  intersection,
  intersectionWith,
  concat
} = lodash

import SPDX from '@clearlydefined/spdx'
import extend from 'extend'
import { minimatch } from 'minimatch'
import parse from 'spdx-expression-parse'
import EntityCoordinates from '../lib/entityCoordinates.ts'
import {
  addArrayToSet,
  buildSourceUrl,
  isDeclaredLicense,
  setIfValue,
  setToArray,
  simplifyAttributions,
  updateSourceLocation
} from '../lib/utils.ts'
import memoryCache from '../providers/caching/memory.ts'
import logger from '../providers/logging/logger.ts'
import validator from '../schemas/validator.ts'

/** Score breakdown for the described dimension */
export interface DescribedScore {
  total: number
  date: number
  source: number
}

/** Score breakdown for the licensed dimension */
export interface LicensedScore {
  total: number
  declared: number
  discovered: number
  consistency: number
  spdx: number
  texts: number
}

/** Combined scores for a definition */
export interface DefinitionScores {
  effective: number
  tool: number
}

/** Source location information */
export interface SourceLocation {
  type?: string
  provider?: string
  namespace?: string
  name?: string
  revision?: string
  url?: string
}

/** Described section of a definition */
export interface DefinitionDescribed {
  releaseDate?: string
  sourceLocation?: SourceLocation
  tools?: string[]
  toolScore?: DescribedScore
  score?: DescribedScore
  projectWebsite?: string
  facets?: Record<string, string[]>
}

/** Attribution information for a facet */
export interface FacetAttribution {
  unknown: number
  parties?: string[]
}

/** Discovered license information for a facet */
export interface FacetDiscovered {
  unknown: number
  expressions?: string[]
}

/** Facet summary information */
export interface FacetInfo {
  attribution: FacetAttribution
  discovered: FacetDiscovered
  files: number
}

/** Licensed section of a definition */
export interface DefinitionLicensed {
  declared?: string
  toolScore?: LicensedScore
  score?: LicensedScore
  facets?: Record<string, FacetInfo>
}

/** File entry in a definition */
export interface DefinitionFile {
  path: string
  license?: string
  attributions?: string[]
  hashes?: Record<string, string>
  token?: string
  natures?: string[]
  facets?: string[]
}

/** Metadata section of a definition */
export interface DefinitionMeta {
  schemaVersion: string
  updated: string
}

/** Complete definition object */
export interface Definition {
  coordinates: EntityCoordinates
  described?: DefinitionDescribed
  licensed?: DefinitionLicensed
  files?: DefinitionFile[]
  scores?: DefinitionScores
  _meta?: DefinitionMeta
}

/** Query parameters for finding definitions */
export interface DefinitionFindQuery {
  type?: string
  provider?: string
  namespace?: string
  name?: string
  license?: string
  releasedAfter?: string
  releasedBefore?: string
  minLicensedScore?: number
  maxLicensedScore?: number
  minDescribedScore?: number
  maxDescribedScore?: number
  continuationToken?: string
}

/** Result of a find operation */
export interface DefinitionFindResult {
  data: Definition[]
  continuationToken?: string
}

/** Harvest store interface */
export interface HarvestStore {
  list(coordinates: EntityCoordinates): Promise<string[]>
  getAllLatest(coordinates: EntityCoordinates): Promise<Record<string, Record<string, any>>>
}

/** Harvest service interface */
export interface HarvestService {
  harvest(request: { tool: string; coordinates: EntityCoordinates }, rebuild?: boolean): Promise<void>
  done(coordinates: EntityCoordinates): Promise<void>
}

/** Summary service interface */
export interface SummaryService {
  summarizeAll(
    coordinates: EntityCoordinates,
    data: Record<string, Record<string, any>>
  ): Record<string, Record<string, any>>
}

/** Aggregation service interface */
export interface AggregationService {
  process(summarized: Record<string, Record<string, any>>, coordinates: EntityCoordinates): Partial<Definition> | null
}

/** Curation service interface */
export interface CurationService {
  get(coordinates: EntityCoordinates, pr: number | string): Promise<any>
  list(coordinates: EntityCoordinates): Promise<EntityCoordinates[]>
  apply(coordinates: EntityCoordinates, curationSpec: any, definition: Partial<Definition>): Promise<Definition>
  autoCurate(definition: Definition): Promise<void>
}

/** Definition store interface */
export interface DefinitionStore {
  initialize(): Promise<void>
  get(coordinates: EntityCoordinates): Promise<Definition | null>
  store(definition: Definition): Promise<void>
  delete(coordinates: EntityCoordinates): Promise<void>
  list(coordinates: EntityCoordinates): Promise<string[]>
  find(query: DefinitionFindQuery, continuationToken?: string): Promise<DefinitionFindResult>
}

/** Search service interface */
export interface SearchService {
  suggestCoordinates(pattern: string): Promise<string[]>
  store?(definition: Definition): Promise<void>
}

/** Upgrade handler interface */
export interface UpgradeHandler {
  currentSchema?: string
  validate(definition: Definition | null): Promise<Definition | null | undefined>
}

/** Minimal DefinitionService shape required by recompute compute policies */
export type RecomputeContext = Pick<
  DefinitionService,
  'currentSchema' | 'computeStoreAndCurate' | 'buildEmptyDefinition'
>

/** Unified recompute handler interface (upgrade + non-force compute fallback) */
export interface RecomputeHandler extends UpgradeHandler {
  initialize(): Promise<void> | void
  setupProcessing(definitionService?: DefinitionService, logger?: Logger, once?: boolean): Promise<void> | void
  compute(definitionService: RecomputeContext, coordinates: EntityCoordinates): Promise<Definition | undefined>
}

const computeLock = memoryCache({
  defaultTtlSeconds: 60 * 5 /* 5 mins */
})

const currentSchema = '1.7.0'

const COMPUTE_LOCK_WARN_MS = 60_000

const weights = {
  declared: 30,
  discovered: 25,
  consistency: 15,
  spdx: 15,
  texts: 15,
  date: 30,
  source: 70
}

/**
 * Service for managing component definitions.
 * Handles computation, caching, storage, and retrieval of definitions.
 */
export class DefinitionService {
  harvestStore: HarvestStore
  harvestService: HarvestService
  summaryService: SummaryService
  aggregationService: AggregationService
  curationService: CurationService
  definitionStore: DefinitionStore
  search: SearchService
  cache: ICache
  recomputeHandler: RecomputeHandler
  logger: Logger

  constructor(
    harvestStore: HarvestStore,
    harvestService: HarvestService,
    summary: SummaryService,
    aggregator: AggregationService,
    curation: CurationService,
    store: DefinitionStore,
    search: SearchService,
    cache: ICache,
    recomputeHandler: RecomputeHandler
  ) {
    this.harvestStore = harvestStore
    this.harvestService = harvestService
    this.summaryService = summary
    this.aggregationService = aggregator
    this.curationService = curation
    this.definitionStore = store
    this.search = search
    this.cache = cache
    this.recomputeHandler = recomputeHandler
    if (this.recomputeHandler) {
      this.recomputeHandler.currentSchema = currentSchema
    }
    this.logger = logger()
  }

  get currentSchema() {
    return currentSchema
  }

  /**
   * Get the final representation of the specified definition and optionally apply the indicated
   * curation.
   */
  async get(
    coordinates: EntityCoordinates,
    pr: number | string | null = null,
    force: boolean = false,
    expand: string | null = null
  ): Promise<Definition | undefined> {
    if (!validator.validate('coordinates-1.0', coordinates)) {
      return undefined
    }
    if (pr) {
      const curation = this.curationService.get(coordinates, pr)
      return this.compute(coordinates, curation)
    }

    const existing = await this._cacheExistingAside(coordinates, force)
    let result = await this.recomputeHandler.validate(existing)
    if (result) {
      this._logDefinitionStatus(result, coordinates)
    } else if (force) {
      // force=true bypasses curations intentionally — it recomputes raw harvest
      // data only, without re-applying curation overlays.
      result = await this.computeAndStore(coordinates)
    } else {
      result = await this.recomputeHandler.compute(this, coordinates)
    }
    return this._trimDefinition(this._cast(result), expand)
  }

  /** Get directly from cache or store without any side effect, like compute */
  async getStored(coordinates: EntityCoordinates): Promise<Definition | null> {
    const cacheKey = this._getCacheKey(coordinates)
    this.logger.debug('1:Redis:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return cached
    }
    this.logger.debug('2:blob+mongoDB:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const stored = await this.definitionStore.get(coordinates)
    if (stored) {
      this._setDefinitionInCache(cacheKey, stored)
    }
    return stored
  }

  _logDefinitionStatus(definition: Definition, coordinates: EntityCoordinates): void {
    if (this._isEmpty(definition)) {
      this.logger.debug('definition harvest in progress', {
        coordinates: coordinates.toString()
      })
    } else {
      // Log line used for /status page insights
      this.logger.debug('computed definition available', {
        coordinates: coordinates.toString()
      })
    }
  }

  async _cacheExistingAside(coordinates: EntityCoordinates, force: boolean): Promise<Definition | null> {
    if (force) {
      return null
    }
    return await this.getStored(coordinates)
  }

  async _setDefinitionInCache(cacheKey: string, itemToStore: Definition): Promise<void> {
    // 1000 is a magic number here -- we don't want to cache very large definitions, as it can impact redis ops
    if (itemToStore.files && itemToStore.files.length > 1000) {
      this.logger.debug('Skipping caching for key', {
        coordinates: itemToStore.coordinates.toString()
      })
      // remove any previously cached (now stale) value
      await this.cache.delete(cacheKey)
      return
    }

    // TTL for two days, in seconds
    await this.cache.set(cacheKey, itemToStore, 60 * 60 * 24 * 2)
  }

  _trimDefinition(definition: Definition, expand: string | null): any {
    if (expand === '-files') {
      return omit(definition, 'files')
    }
    return definition
  }

  _cast(definition: Definition): Definition {
    definition.coordinates = EntityCoordinates.fromObject(definition.coordinates)
    return definition
  }

  /**
   * Get all of the definition entries available for the given coordinates. The coordinates must be
   * specified down to the revision. The result will have an entry per discovered definition.
   */
  async getAll(
    coordinatesList: EntityCoordinates[],
    force: boolean = false,
    expand: string | null = null
  ): Promise<Record<string, Definition>> {
    const result: Record<string, Definition> = {}
    const promises = coordinatesList.map(
      throat(10, async (coordinates: EntityCoordinates) => {
        this.logger.debug(`1:1:notice_generate:get_single_start:${coordinates}`, { ts: new Date().toISOString() })
        const definition = await this.get(coordinates, null, force, expand)
        this.logger.debug(`1:1:notice_generate:get_single_end:${coordinates}`, {
          ts: new Date().toISOString()
        })
        if (!definition) {
          return
        }
        const key = definition.coordinates.toString()
        result[key] = definition
      })
    )
    await Promise.all(promises)
    return result
  }

  /** Get a list of coordinates for all known definitions that match the given coordinates */
  async list(coordinates: EntityCoordinates, recompute: boolean = false): Promise<string[]> {
    if (!recompute) {
      return this.definitionStore.list(coordinates)
    }
    const curated = (await this.curationService.list(coordinates)).map(c => c.toString())
    const tools = await this.harvestStore.list(coordinates)
    const harvest = tools.map(tool => EntityCoordinates.fromString(tool).toString())
    return sortedUniq([...harvest, ...curated])
  }

  /** Get a list of all the definitions that exist in the store matching the given coordinates */
  async listAll(coordinatesList: EntityCoordinates[]): Promise<EntityCoordinates[]> {
    //Take the array of coordinates, strip out the revision and only return uniques
    const searchCoordinates = uniqWith(
      coordinatesList.map(coordinates => coordinates.asRevisionless()),
      isEqual
    )
    const promises = searchCoordinates.map(
      throat(10, async (coordinates: EntityCoordinates) => {
        try {
          return await this.list(coordinates)
        } catch (error) {
          const err = error as Error
          this.logger.error('failed to list definitions', {
            error: err.message
          })
          return null
        }
      })
    )
    const foundDefinitions = flatten(await Promise.all(concat(promises)))
    // Filter only the revisions matching the found definitions
    return intersectionWith(
      coordinatesList,
      foundDefinitions,
      (a, b) => a && b && a.toString().toLowerCase() === b.toString().toLowerCase()
    )
  }

  /** Get the definitions that exist in the store matching the given query */
  find(query: DefinitionFindQuery): Promise<DefinitionFindResult> {
    return this.definitionStore.find(query, query.continuationToken)
  }

  /**
   * Invalidate the definition for the identified component. This flushes any caches and pre-computed
   * results. The definition will be recomputed on or before the next use.
   */
  invalidate(coordinates: EntityCoordinates | EntityCoordinates[]): Promise<void[]> {
    const coordinateList = Array.isArray(coordinates) ? coordinates : [coordinates]
    return Promise.all(
      coordinateList.map(
        throat(10, async (coordinates: EntityCoordinates) => {
          await this.definitionStore.delete(coordinates)
          await this.cache.delete(this._getCacheKey(coordinates))
        })
      )
    )
  }

  _validate(definition: Definition): void {
    if (!validator.validate('definition', definition)) {
      throw new Error(validator.errorsText())
    }
  }

  /** Compute and store a definition, then trigger auto-curation */
  async computeStoreAndCurate(coordinates: EntityCoordinates): Promise<Definition> {
    return this._withComputeLock(coordinates, async () => {
      const definition = await this._computeAndStore(coordinates)
      await this.curationService.autoCurate(definition)
      return definition
    })
  }

  /**
   * Acquire computeLock, evaluate shouldCompute(), and conditionally compute+store+curate.
   * Serializes compute per coordinate — check-then-act is atomic inside the lock.
   */
  async computeStoreAndCurateIf(
    coordinates: EntityCoordinates,
    shouldCompute: () => Promise<boolean>
  ): Promise<Definition | undefined> {
    return this._withComputeLock(coordinates, async () => {
      if (!(await shouldCompute())) {
        return undefined
      }
      const definition = await this._computeAndStore(coordinates)
      await this.curationService.autoCurate(definition)
      return definition
    })
  }

  /** Acquire computeLock and run the action while holding the lock. */
  async _withComputeLock<T>(coordinates: EntityCoordinates, action: () => Promise<T>): Promise<T> {
    this.logger.debug('3:memory_lock:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const lockWaitStart = Date.now()
    let lockWarnLogged = false
    while (computeLock.get(coordinates.toString())) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (!lockWarnLogged && Date.now() - lockWaitStart > COMPUTE_LOCK_WARN_MS) {
        this.logger.warn(`computeLock spin-wait exceeded ${COMPUTE_LOCK_WARN_MS / 1000}s`, {
          coordinates: coordinates.toString()
        })
        lockWarnLogged = true
      }
    }
    try {
      // No `await` between the while-exit and set() — this is intentional.
      // Inserting an async call here would break the lock.
      computeLock.set(coordinates.toString(), true)
      return await action()
    } finally {
      computeLock.delete(coordinates.toString())
    }
  }

  /** Compute and store a definition */
  async computeAndStore(coordinates: EntityCoordinates): Promise<Definition> {
    return this._withComputeLock(coordinates, () => this._computeAndStore(coordinates))
  }

  /** Compute and store a definition if the tool result is new */
  async computeAndStoreIfNecessary(
    coordinates: EntityCoordinates,
    tool: string,
    toolRevision: string
  ): Promise<Definition | undefined> {
    return this._withComputeLock(coordinates, async () => {
      if (!(await this._isToolResultNew(coordinates, tool, toolRevision))) {
        this.logger.info('definition computation skipped: tool result processed', {
          coordinates: coordinates.toString(),
          tool,
          toolRevision
        })
        return undefined
      }
      return await this._computeAndStore(coordinates)
    })
  }

  async _isToolResultNew(coordinates: EntityCoordinates, tool: string, toolRevision: string): Promise<boolean> {
    const definitionFound = await this.getStored(coordinates)
    const toolVersionToAdd = `${tool}/${toolRevision}`
    const tools = definitionFound?.described?.tools || []
    return !tools.includes(toolVersionToAdd)
  }

  async _computeAndStore(coordinates: EntityCoordinates): Promise<Definition> {
    const definition = await this.compute(coordinates)
    // If no tools participated in the creation of the definition then don't bother storing.
    if (this._isEmpty(definition)) {
      // Log line used for /status page insights
      this.logger.info('definition not available', {
        coordinates: coordinates.toString()
      })
      this._harvest(coordinates) // fire and forget
      // cache the computed empty definition to avoid repeated recompute attempts
      const cacheKey = this._getCacheKey(coordinates)
      await this._setDefinitionInCache(cacheKey, definition)
      return definition
    }
    // Log line used for /status page insights
    this.logger.info('recomputed definition available', {
      coordinates: coordinates.toString()
    })
    await this._store(definition)
    return definition
  }

  async _harvest(coordinates: EntityCoordinates): Promise<void> {
    try {
      this.logger.debug('trigger_harvest:start', {
        ts: new Date().toISOString(),
        coordinates: coordinates.toString()
      })
      await this.harvestService.harvest({ tool: 'component', coordinates }, true)
      this.logger.debug('trigger_harvest:end', {
        ts: new Date().toISOString(),
        coordinates: coordinates.toString()
      })
    } catch (error) {
      this.logger.info('failed to harvest from definition service', {
        crawlerError: error,
        coordinates: coordinates.toString()
      })
    }
  }
  async _store(definition: Definition): Promise<void> {
    this.logger.debug('storing definition', {
      coordinates: definition.coordinates.toString()
    })
    await this.definitionStore.store(definition)
    this.logger.debug('definition stored successfully', {
      coordinates: definition.coordinates.toString()
    })
    await this._setDefinitionInCache(this._getCacheKey(definition.coordinates), definition)
    await this.harvestService.done(definition.coordinates)
  }

  /**
   * Compute the final representation of the specified definition and optionally apply the indicated
   * curation.
   */
  async compute(coordinates: EntityCoordinates, curationSpec?: any): Promise<Definition> {
    this.logger.debug('4:compute:blob:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const raw = await this.harvestStore.getAllLatest(coordinates)
    this.logger.debug('4:compute:blob:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    coordinates = this._getCasedCoordinates(raw, coordinates)
    this.logger.debug('5:compute:summarize:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const summaries = await this.summaryService.summarizeAll(coordinates, raw)
    this.logger.debug('6:compute:aggregate:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    const aggregatedDefinition = (await this.aggregationService.process(summaries, coordinates)) || {}
    this.logger.debug('6:compute:aggregate:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    aggregatedDefinition.coordinates = coordinates
    this._ensureToolScores(coordinates, aggregatedDefinition as Definition)
    const definition = await this.curationService.apply(coordinates, curationSpec, aggregatedDefinition)
    this._calculateValidate(coordinates, definition)
    return definition
  }

  /** Build a valid empty definition for the provided coordinates. */
  buildEmptyDefinition(givenCoordinates: EntityCoordinates): Definition {
    const coordinates = this._getCasedCoordinates({}, givenCoordinates)
    const definition = { coordinates }
    this._ensureToolScores(coordinates, definition)
    this._calculateValidate(coordinates, definition)
    return definition
  }

  _calculateValidate(coordinates: EntityCoordinates, definition: Definition): void {
    this.logger.debug('9:compute:calculate:start', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
    this._finalizeDefinition(coordinates, definition)
    this._ensureCuratedScores(definition)
    this._ensureFinalScores(definition)
    // protect against any element of the compute producing an invalid definition
    this._ensureNoNulls(definition)
    this._validate(definition)
    this.logger.debug('9:compute:calculate:end', {
      ts: new Date().toISOString(),
      coordinates: coordinates.toString()
    })
  }

  _getCasedCoordinates(raw: Record<string, Record<string, any>>, coordinates: EntityCoordinates): EntityCoordinates {
    if (!raw || !Object.keys(raw).length) {
      return coordinates
    }
    for (const tool in raw) {
      for (const version in raw[tool]) {
        const cased = get(raw[tool][version], '_metadata.links.self.href')
        if (cased) {
          return EntityCoordinates.fromUrn(cased)
        }
      }
    }
    throw new Error('unable to find self link')
  }

  /**
   * Ensure that the given object (e.g., a definition) does not have any null properties.
   * Recursively removes null values from the object.
   */
  _ensureNoNulls(object: Record<string, any>): void {
    for (const key of Object.keys(object)) {
      if (object[key] && typeof object[key] === 'object') {
        this._ensureNoNulls(object[key])
      } else if (object[key] == null) {
        delete object[key]
      }
    }
  }

  /**
   * Compute and store the scores for the given definition but do it in a way that does not affect the
   * definition so that further curations can be done.
   */
  _ensureToolScores(coordinates: EntityCoordinates, definition: Definition): void {
    const rawDefinition = extend(true, {}, definition)
    this._finalizeDefinition(coordinates, rawDefinition)
    const { describedScore, licensedScore } = this._computeScores(rawDefinition)
    set(definition, 'described.toolScore', describedScore)
    set(definition, 'licensed.toolScore', licensedScore)
  }

  _ensureCuratedScores(definition: Definition): void {
    const { describedScore, licensedScore } = this._computeScores(definition)
    set(definition, 'described.score', describedScore)
    set(definition, 'licensed.score', licensedScore)
  }

  _ensureFinalScores(definition: Definition): void {
    const { described, licensed } = definition
    set(definition, 'scores.effective', Math.floor((described.score.total + licensed.score.total) / 2))
    set(definition, 'scores.tool', Math.floor((described.toolScore.total + licensed.toolScore.total) / 2))
  }

  _finalizeDefinition(coordinates: EntityCoordinates, definition: Definition): void {
    this._ensureFacets(definition)
    this._ensureSourceLocation(coordinates, definition)
    set(definition, '_meta.schemaVersion', currentSchema)
    set(definition, '_meta.updated', new Date().toISOString())
  }

  _computeScores(definition: Definition): { licensedScore: LicensedScore; describedScore: DescribedScore } {
    return {
      licensedScore: this._computeLicensedScore(definition),
      describedScore: this._computeDescribedScore(definition)
    }
  }

  _computeDescribedScore(definition: Definition): DescribedScore {
    const date = get(definition, 'described.releaseDate') ? weights.date : 0
    const source = get(definition, 'described.sourceLocation.url') ? weights.source : 0
    const total = date + source
    return { total, date, source }
  }

  _computeLicensedScore(definition: Definition): LicensedScore {
    const declared = this._computeDeclaredScore(definition)
    const discovered = this._computeDiscoveredScore(definition)
    const consistency = this._computeConsistencyScore(definition)
    const spdx = this._computeSPDXScore(definition)
    const texts = this._computeTextsScore(definition)
    const total = declared + discovered + consistency + spdx + texts
    return { total, declared, discovered, consistency, spdx, texts }
  }

  _computeDeclaredScore(definition: Definition): number {
    const declared = get(definition, 'licensed.declared')
    return isDeclaredLicense(declared) ? weights.declared : 0
  }

  _computeDiscoveredScore(definition: Definition): number {
    if (!definition.files) {
      return 0
    }
    const coreFiles = definition.files.filter(DefinitionService._isInCoreFacet)
    if (!coreFiles.length) {
      return 0
    }
    const completeFiles = coreFiles.filter(file => file.license && file.attributions?.length)
    return Math.round((completeFiles.length / coreFiles.length) * weights.discovered)
  }

  _computeConsistencyScore(definition: Definition): number {
    const declared = get(definition, 'licensed.declared')
    // Note here that we are saying that every discovered license is satisfied by the declared
    // license. If there are no discovered licenses then all is good.
    const discovered = get(definition, 'licensed.facets.core.discovered.expressions') || []
    if (!declared || !discovered) {
      return 0
    }
    return discovered.every(expression => SPDX.satisfies(expression, declared)) ? weights.consistency : 0
  }
  _computeSPDXScore(definition: Definition): number {
    const declaredLicense = get(definition, 'licensed.declared')
    if (!declaredLicense) {
      return 0
    }
    try {
      parse(declaredLicense) // use strict spdx-expression-parse
      return weights.spdx
    } catch (e) {
      this.logger.debug('Could not parse declared license expression.', {
        errorMessage: (e as Error).message
      })
      return 0
    }
  }

  _computeTextsScore(definition: Definition): number {
    if (!definition.files?.length) {
      return 0
    }
    const includedTexts = this._collectLicenseTexts(definition)
    if (!includedTexts.length) {
      return 0
    }
    const referencedLicenses = this._collectReferencedLicenses(definition)
    if (!referencedLicenses.length) {
      return 0
    }

    // check that all the referenced licenses have texts
    const found = intersection(referencedLicenses, includedTexts)
    return found.length === referencedLicenses.length ? weights.texts : 0
  }

  _collectReferencedLicenses(definition: Definition): string[] {
    const referencedExpressions = new Set(get(definition, 'licensed.facets.core.discovered.expressions') || [])
    const declared = get(definition, 'licensed.declared')
    if (declared) {
      referencedExpressions.add(declared)
    }
    const result: Set<string> = new Set()
    for (const expression of referencedExpressions) {
      this._extractLicensesFromExpression(expression, result)
    }
    return Array.from(result)
  }

  _collectLicenseTexts(definition: Definition): string[] {
    const result: Set<string> = new Set()
    for (const file of definition.files.filter(DefinitionService._isLicenseFile)) {
      this._extractLicensesFromExpression(file.license, result)
    }
    return Array.from(result)
  }

  _extractLicensesFromExpression(expression: string | SpdxExpression | null | undefined, seen: Set<string>): void {
    if (!expression) {
      return
    }
    const parsed: SpdxExpression = typeof expression === 'string' ? SPDX.parse(expression) : expression
    if (parsed.license) {
      seen.add(parsed.license)
      return
    }
    this._extractLicensesFromExpression(parsed.left, seen)
    this._extractLicensesFromExpression(parsed.right, seen)
  }

  static _isInCoreFacet(file: DefinitionFile): boolean {
    return !file.facets || file.facets.includes('core')
  }

  /** Answer whether or not the given file is a license text file */
  static _isLicenseFile(file: DefinitionFile): boolean {
    return file.token && DefinitionService._isInCoreFacet(file) && (file.natures || []).includes('license')
  }

  /** Suggest a set of definition coordinates that match the given pattern. Only existing definitions are searched. */
  suggestCoordinates(pattern: string): Promise<string[]> {
    return this.search.suggestCoordinates(pattern)
  }

  /**
   * Helper method to prime the search store while getting the system up and running.
   * Should not be needed in general.
   */
  async reload(mode: string, coordinatesList: string[] | null = null): Promise<(undefined | null)[]> {
    const recompute = mode === 'definitions'
    const baseList = coordinatesList || (await this.list(new EntityCoordinates(), recompute))
    const list = baseList.map(entry => EntityCoordinates.fromString(entry))
    return await Promise.all(
      list.map(
        throat(10, async (coordinates: EntityCoordinates) => {
          try {
            const definition = await this.get(coordinates, null, recompute)
            if (recompute) {
              return Promise.resolve(null)
            }
            if (this.search.store) {
              return this.search.store(definition)
            }
          } catch (error) {
            this.logger.info('failed to reload in definition service', {
              error,
              coordinates: coordinates.toString()
            })
          }
        })
      )
    )
  }

  _ensureFacets(definition: Definition): void {
    if (!definition.files) {
      return
    }
    const facetFiles = this._computeFacetFiles([...definition.files], get(definition, 'described.facets'))
    for (const facet in facetFiles) {
      setIfValue(definition, `licensed.facets.${facet}`, this._summarizeFacetInfo(facet, facetFiles[facet]))
    }
  }

  _computeFacetFiles(
    files: DefinitionFile[],
    facets: Record<string, string[]> = {}
  ): Record<string, DefinitionFile[]> {
    const facetList = Object.getOwnPropertyNames(facets)
    remove(facetList, 'core')
    if (facetList.length === 0) {
      return { core: files }
    }
    const result: Record<string, DefinitionFile[]> = { core: [...files] }
    for (const facet in facetList) {
      const facetKey = facetList[facet]
      const filters = facets[facetKey]
      if (!filters || filters.length === 0) {
        break
      }
      result[facetKey] = files.filter(file => filters.some(filter => minimatch(file.path, filter)))
      pullAllWith(result['core'], result[facetKey], isEqual)
    }
    return result
  }

  /**
   * Create the data object for the identified facet containing the given files. Also destructively brand
   * the individual file objects with the facet.
   */
  _summarizeFacetInfo(facet: string, facetFiles: DefinitionFile[]): FacetInfo | null {
    if (!facetFiles || facetFiles.length === 0) {
      return null
    }
    const attributions: Set<string> = new Set()
    const licenseExpressions: Set<string> = new Set()
    let unknownParties = 0
    let unknownLicenses = 0
    // accumulate all the licenses and attributions, and count anything that's missing
    for (const file of facetFiles) {
      file.license ? licenseExpressions.add(file.license) : unknownLicenses++
      const statements = simplifyAttributions(file.attributions)
      setIfValue(file, 'attributions', statements)
      statements ? addArrayToSet(statements, attributions) : unknownParties++
      if (facet !== 'core') {
        // tag the file with the current facet if not core
        file.facets = file.facets || []
        file.facets.push(facet)
      }
    }
    const result = {
      attribution: {
        unknown: unknownParties
      },
      discovered: {
        unknown: unknownLicenses
      },
      files: facetFiles.length
    }
    setIfValue(result, 'attribution.parties', simplifyAttributions(setToArray(attributions)))
    // TODO need a function to reduce/simplify sets of expressions
    setIfValue(result, 'discovered.expressions', setToArray(licenseExpressions))
    return result
  }

  _ensureDescribed(definition: Definition): void {
    definition.described = definition.described || {}
  }

  _ensureSourceLocation(coordinates: EntityCoordinates, definition: Definition): void {
    if (get(definition, 'described.sourceLocation')) {
      return updateSourceLocation(definition.described.sourceLocation)
    }
    // For source components there may not be an explicit harvested source location (it is self-evident)
    // Make it explicit in the definition
    switch (coordinates.type) {
      case 'go':
      case 'git':
      case 'sourcearchive':
      case 'pypi': {
        const url = buildSourceUrl(coordinates)
        if (!url) {
          return
        }
        this._ensureDescribed(definition)
        definition.described.sourceLocation = { ...coordinates, url }
        break
      }
      default:
        return
    }
  }

  /** @deprecated This method is currently unused */
  _getDefinitionCoordinates(coordinates: EntityCoordinates): object {
    return Object.assign({}, coordinates, {
      tool: 'definition',
      toolVersion: 1
    })
  }

  /**
   * Check if a definition is empty (no tools have contributed to it).
   * Note that curation is a tool so no tools really means the definition is effectively empty.
   */
  _isEmpty(definition: Definition): boolean {
    const tools = get(definition, 'described.tools')
    return !tools || tools.length === 0
  }

  _getCacheKey(coordinates: EntityCoordinates): string {
    return `def_${EntityCoordinates.fromObject(coordinates).toString().toLowerCase()}`
  }
}

export default (
  harvestStore: HarvestStore,
  harvestService: HarvestService,
  summary: SummaryService,
  aggregator: AggregationService,
  curation: CurationService,
  store: DefinitionStore,
  search: SearchService,
  cache: ICache,
  recomputeHandler: RecomputeHandler
): DefinitionService =>
  new DefinitionService(
    harvestStore,
    harvestService,
    summary,
    aggregator,
    curation,
    store,
    search,
    cache,
    recomputeHandler
  )
