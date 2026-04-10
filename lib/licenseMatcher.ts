// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { Definition } from './utils.ts'

const { get, isEqual: isDeepEqual } = lodash

import logger from '../providers/logging/logger.js'
import { getLatestVersion, isLicenseFile } from './utils.ts'

/** Harvest data for a coordinate, organized by tool and version */
export interface CoordinateHarvest {
  [tool: string]: {
    [version: string]: unknown
  }
}

/** Source/target data bundle for license matching */
export interface LicenseMatchInput {
  definition: Definition
  harvest: CoordinateHarvest
}

/** A single match result entry */
export interface MatchEntry {
  policy: string
  file?: string
  propPath: string
  value: unknown
}

/** A single mismatch result entry */
export interface MismatchEntry {
  policy: string
  file?: string
  propPath: string
  source: unknown
  target: unknown
}

/** Result from comparing two license sources */
export interface CompareResult {
  match: MatchEntry[]
  mismatch: MismatchEntry[]
}

/** Final result from license matching process */
export interface LicenseMatchResult {
  isMatching: boolean
  match?: MatchEntry[]
  mismatch?: MismatchEntry[]
}

/** Interface for license match policies */
export interface LicenseMatchPolicy {
  name: string
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult
}

class LicenseMatcher {
  private _policies: LicenseMatchPolicy[]

  /**
   * Creates a new LicenseMatcher
   */
  constructor(policies?: LicenseMatchPolicy[]) {
    this._policies = policies || [new DefinitionLicenseMatchPolicy(), new HarvestLicenseMatchPolicy()]
  }

  /**
   * Given two coordinates with different revisions, decide whether they have the same license
   */
  process(source: LicenseMatchInput, target: LicenseMatchInput): LicenseMatchResult {
    const compareResults = this._policies
      .map((policy: LicenseMatchPolicy) => policy.compare(source, target))
      .reduce((acc: CompareResult, cur: CompareResult) => ({
        match: acc.match.concat(cur.match),
        mismatch: acc.mismatch.concat(cur.mismatch)
      }))
    const allInconclusive = compareResults.mismatch.length === 0 && compareResults.match.length === 0
    if (compareResults.mismatch.length || allInconclusive) {
      return {
        isMatching: false,
        mismatch: compareResults.mismatch
      }
    }
    return {
      isMatching: true,
      match: compareResults.match
    }
  }
}

/**
 * Policy that compares license files in definitions by hash and token
 */
class DefinitionLicenseMatchPolicy implements LicenseMatchPolicy {
  name: string
  private _compareProps: string[]

  constructor() {
    this.name = 'definition'
    this._compareProps = ['hashes.sha1', 'hashes.sha256', 'token']
  }

  /**
   * Compare license files between source and target definitions
   */
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult {
    const fileMap = this._generateFileMap(source, target)
    return this._compareFileInMap(fileMap)
  }

  _generateFileMap(
    source: LicenseMatchInput,
    target: LicenseMatchInput
  ): Map<string, { sourceFile?: object; targetFile?: object }> {
    const sourceLicenseFiles = this._getLicenseFile(source.definition)
    const targetLicenseFiles = this._getLicenseFile(target.definition)
    const fileMap = new Map()
    this._addFileToMap(fileMap, sourceLicenseFiles, 'sourceFile')
    this._addFileToMap(fileMap, targetLicenseFiles, 'targetFile')
    return fileMap
  }

  _addFileToMap(
    fileMap: Map<string, { sourceFile?: object; targetFile?: object }>,
    files: object[],
    propName: 'sourceFile' | 'targetFile'
  ) {
    if (files) {
      for (const f of files as { path?: string }[]) {
        if (!f.path) {
          continue
        }
        const current = fileMap.get(f.path) || ({} as { sourceFile?: object; targetFile?: object })
        current[propName] = f
        fileMap.set(f.path, current)
      }
    }
  }

  _getLicenseFile(definition: {
    files?: Array<{ path?: string }>
    coordinates?: import('./entityCoordinates.ts').default
  }): object[] | undefined {
    return definition.files?.filter((f: { path?: string }) => isLicenseFile(f.path, definition.coordinates))
  }

  _compareFileInMap(fileMap: Map<string, { sourceFile?: object; targetFile?: object }>): CompareResult {
    const result: CompareResult = {
      match: [],
      mismatch: []
    }
    for (const [path, { sourceFile, targetFile }] of fileMap) {
      for (const propPath of this._compareProps) {
        const sourceValue = get(sourceFile, propPath)
        const targetValue = get(targetFile, propPath)
        if (!sourceValue && !targetValue) {
          continue
        }
        if (sourceValue === targetValue) {
          result.match.push({
            policy: this.name,
            file: path,
            propPath,
            value: sourceValue
          })
        } else {
          result.mismatch.push({
            policy: this.name,
            file: path,
            propPath,
            source: sourceValue,
            target: targetValue
          })
        }
      }
    }
    return result
  }
}

/**
 * Policy that compares license information from harvest data
 */
class HarvestLicenseMatchPolicy implements LicenseMatchPolicy {
  name: string

  constructor() {
    this.name = 'harvest'
  }

  /**
   * Compare harvest license data between source and target
   */
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult {
    const type = source.definition.coordinates.type
    const strategy = this._getStrategy(type)
    return strategy.compare(source, target)
  }

  _getStrategy(type: string): BaseHarvestLicenseMatchStrategy {
    switch (type) {
      case 'maven':
        return new BaseHarvestLicenseMatchStrategy('maven', ['manifest.summary.licenses'])
      case 'conda':
        return new BaseHarvestLicenseMatchStrategy('conda', ['declaredLicenses'])
      case 'condasrc':
        return new BaseHarvestLicenseMatchStrategy('condasrc', ['declaredLicenses'])
      case 'crate':
        return new BaseHarvestLicenseMatchStrategy('crate', ['registryData.license'])
      case 'pod':
        return new BaseHarvestLicenseMatchStrategy('pod', ['registryData.license'])
      case 'nuget':
        return new NugetHarvestLicenseMatchStrategy()
      case 'npm':
        return new BaseHarvestLicenseMatchStrategy('npm', ['registryData.manifest.license'])
      case 'composer':
        return new BaseHarvestLicenseMatchStrategy('composer', ['registryData.manifest.license'])
      case 'gem':
        return new BaseHarvestLicenseMatchStrategy('gem', ['registryData.licenses'])
      case 'pypi':
        return new BaseHarvestLicenseMatchStrategy('pypi', ['declaredLicense', 'registryData.info.license'])
      case 'deb':
        return new BaseHarvestLicenseMatchStrategy('deb', ['declaredLicenses'])
      case 'debsrc':
        return new BaseHarvestLicenseMatchStrategy('debsrc', ['declaredLicenses'])
      default:
        return new BaseHarvestLicenseMatchStrategy('default')
    }
  }
}

/**
 * Base strategy for comparing harvest license data
 */
class BaseHarvestLicenseMatchStrategy {
  name: string
  type: string
  propPaths: string[]

  constructor(type: string, propPaths: string[] = []) {
    this.name = 'harvest'
    this.type = type
    this.propPaths = propPaths
  }

  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
    const result: CompareResult = {
      match: [],
      mismatch: []
    }
    for (const propPath of this.propPaths) {
      const sourceLicense = get(sourceLatestClearlyDefinedToolHarvest, propPath)
      const targetLicense = get(targetLatestClearlyDefinedToolHarvest, propPath)
      if (!sourceLicense && !targetLicense) {
        continue
      }
      if (isDeepEqual(sourceLicense, targetLicense)) {
        result.match.push({
          policy: this.name,
          propPath,
          value: sourceLicense
        })
      } else {
        result.mismatch.push({
          policy: this.name,
          propPath,
          source: sourceLicense,
          target: targetLicense
        })
      }
    }
    return result
  }
}

/**
 * Nuget-specific harvest license match strategy
 * @extends BaseHarvestLicenseMatchStrategy
 */
class NugetHarvestLicenseMatchStrategy extends BaseHarvestLicenseMatchStrategy {
  logger: ReturnType<typeof logger>
  excludedLicenseUrl: string[]

  constructor() {
    super('nuget', ['manifest.licenseExpression', 'manifest.licenseUrl'])
    this.logger = logger()
    this.excludedLicenseUrl = ['github.com', 'aka.ms/deprecateLicenseUrl']
  }

  /**
   * @override
   */
  override compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult {
    const result = super.compare(source, target)
    // 1. For Nuget component, if the licenseUrl point to github,
    // the content of the license url is tend to change even the url keeps the same
    // 2. If the licenseUrl point to https://aka.ms/deprecateLicenseUrl, this means
    // this a deprecated license url and there is a license file in the package.
    result.match = result.match.filter(m => {
      if (m.propPath === 'manifest.licenseUrl') {
        this.logger.info('NugetHarvestLicenseMatchStrategy.compare.licenseUrl', { url: m.value })
      }
      const value = m.value as string | undefined
      if (value && this.excludedLicenseUrl.some(url => value.toLowerCase().includes(url.toLowerCase()))) {
        return false
      }
      return true
    })
    return result
  }
}

/**
 * Gets the latest version of a tool's harvest data
 */
function getLatestToolHarvest(coordinateHarvest: CoordinateHarvest, tool: string): object | undefined {
  if (!coordinateHarvest[tool]) {
    return undefined
  }
  const latestVersion = getLatestVersion(Object.keys(coordinateHarvest[tool]))
  return get(coordinateHarvest, [tool, latestVersion]) as object | undefined
}

export { DefinitionLicenseMatchPolicy, HarvestLicenseMatchPolicy, LicenseMatcher }
