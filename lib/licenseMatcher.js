// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('./licenseMatcher').LicenseMatchInput} LicenseMatchInput */
/** @typedef {import('./licenseMatcher').CompareResult} CompareResult */
/** @typedef {import('./licenseMatcher').LicenseMatchResult} LicenseMatchResult */
/** @typedef {import('./licenseMatcher').LicenseMatchPolicy} LicenseMatchPolicy */
/** @typedef {import('./licenseMatcher').MatchEntry} MatchEntry */
/** @typedef {import('./licenseMatcher').MismatchEntry} MismatchEntry */

const { get, isEqual: isDeepEqual } = require('lodash')
const { isLicenseFile, getLatestVersion } = require('./utils')
const logger = require('../providers/logging/logger')

class LicenseMatcher {
  /**
   * Creates a new LicenseMatcher
   * @param {LicenseMatchPolicy[]} [policies] - Optional array of match policies
   */
  constructor(policies) {
    this._policies = policies || [new DefinitionLicenseMatchPolicy(), new HarvestLicenseMatchPolicy()]
  }

  /**
   * Given two coordinates with different revisions, decide whether they have the same license
   * @param {LicenseMatchInput} source - Source definition and harvest data
   * @param {LicenseMatchInput} target - Target definition and harvest data
   * @returns {LicenseMatchResult} Match result with isMatching flag and match/mismatch details
   */
  process(source, target) {
    const compareResults = this._policies
      .map(/** @param {LicenseMatchPolicy} policy */ policy => policy.compare(source, target))
      .reduce(
        /** @param {CompareResult} acc @param {CompareResult} cur */ (acc, cur) => ({
          match: acc.match.concat(cur.match),
          mismatch: acc.mismatch.concat(cur.mismatch)
        })
      )
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
 * @implements {LicenseMatchPolicy}
 */
class DefinitionLicenseMatchPolicy {
  constructor() {
    /** @type {string} */
    this.name = 'definition'
    /** @type {string[]} */
    this._compareProps = ['hashes.sha1', 'hashes.sha256', 'token']
  }

  /**
   * Compare license files between source and target definitions
   * @param {LicenseMatchInput} source - Source definition and harvest data
   * @param {LicenseMatchInput} target - Target definition and harvest data
   * @returns {CompareResult} Comparison result with matches and mismatches
   */
  compare(source, target) {
    const fileMap = this._generateFileMap(source, target)
    return this._compareFileInMap(fileMap)
  }

  /**
   * @param {LicenseMatchInput} source
   * @param {LicenseMatchInput} target
   * @returns {Map<string, {sourceFile?: object, targetFile?: object}>}
   */
  _generateFileMap(source, target) {
    const sourceLicenseFiles = this._getLicenseFile(source.definition)
    const targetLicenseFiles = this._getLicenseFile(target.definition)
    const fileMap = new Map()
    this._addFileToMap(fileMap, sourceLicenseFiles, 'sourceFile')
    this._addFileToMap(fileMap, targetLicenseFiles, 'targetFile')
    return fileMap
  }

  /**
   * @param {Map<string, {sourceFile?: object, targetFile?: object}>} fileMap
   * @param {object[]} files
   * @param {'sourceFile' | 'targetFile'} propName
   */
  _addFileToMap(fileMap, files, propName) {
    files &&
      files.forEach(
        /** @param {{path?: string}} f */ f => {
          if (!f.path) return
          const current = fileMap.get(f.path) || /** @type {{sourceFile?: object, targetFile?: object}} */ ({})
          current[propName] = f
          fileMap.set(f.path, current)
        }
      )
  }

  /**
   * @param {{files?: Array<{path?: string}>, coordinates?: import('./entityCoordinates')}} definition
   * @returns {object[] | undefined}
   */
  _getLicenseFile(definition) {
    return (
      definition.files &&
      definition.files.filter(/** @param {{path?: string}} f */ f => isLicenseFile(f.path, definition.coordinates))
    )
  }

  /**
   * @param {Map<string, {sourceFile?: object, targetFile?: object}>} fileMap
   * @returns {CompareResult}
   */
  _compareFileInMap(fileMap) {
    /** @type {CompareResult} */
    const result = {
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
 * @implements {LicenseMatchPolicy}
 */
class HarvestLicenseMatchPolicy {
  constructor() {
    /** @type {string} */
    this.name = 'harvest'
  }

  /**
   * Compare harvest license data between source and target
   * @param {LicenseMatchInput} source - Source definition and harvest data
   * @param {LicenseMatchInput} target - Target definition and harvest data
   * @returns {CompareResult} Comparison result with matches and mismatches
   */
  compare(source, target) {
    const type = source.definition.coordinates.type
    const strategy = this._getStrategy(type)
    return strategy.compare(source, target)
  }

  /**
   * @param {string} type
   * @returns {BaseHarvestLicenseMatchStrategy}
   */
  _getStrategy(type) {
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
  /**
   * @param {string} type
   * @param {string[]} [propPaths]
   */
  constructor(type, propPaths = []) {
    /** @type {string} */
    this.name = 'harvest'
    /** @type {string} */
    this.type = type
    /** @type {string[]} */
    this.propPaths = propPaths
  }

  /**
   * @param {LicenseMatchInput} source
   * @param {LicenseMatchInput} target
   * @returns {CompareResult}
   */
  compare(source, target) {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
    /** @type {CompareResult} */
    const result = {
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
  constructor() {
    super('nuget', ['manifest.licenseExpression', 'manifest.licenseUrl'])
    this.logger = logger()
    /** @type {string[]} */
    this.excludedLicenseUrl = ['github.com', 'aka.ms/deprecateLicenseUrl']
  }

  /**
   * @override
   * @param {LicenseMatchInput} source
   * @param {LicenseMatchInput} target
   * @returns {CompareResult}
   */
  compare(source, target) {
    const result = super.compare(source, target)
    // 1. For Nuget component, if the licenseUrl point to github,
    // the content of the license url is tend to change even the url keeps the same
    // 2. If the licenseUrl point to https://aka.ms/deprecateLicenseUrl, this means
    // this a deprecated license url and there is a license file in the package.
    result.match = result.match.filter(m => {
      if (m.propPath === 'manifest.licenseUrl') {
        this.logger.info('NugetHarvestLicenseMatchStrategy.compare.licenseUrl', { url: m.value })
      }
      const value = /** @type {string | undefined} */ (m.value)
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
 * @param {import('./licenseMatcher').CoordinateHarvest} coordinateHarvest
 * @param {string} tool
 * @returns {object | undefined}
 */
function getLatestToolHarvest(coordinateHarvest, tool) {
  if (!coordinateHarvest[tool]) {
    return undefined
  }
  const latestVersion = getLatestVersion(Object.keys(coordinateHarvest[tool]))
  return /** @type {object | undefined} */ (get(coordinateHarvest, [tool, latestVersion]))
}

module.exports = {
  LicenseMatcher,
  DefinitionLicenseMatchPolicy,
  HarvestLicenseMatchPolicy
}
