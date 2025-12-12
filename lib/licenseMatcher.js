const { get, isEqual: isDeepEqual } = require('lodash')
const { isLicenseFile, getLatestVersion } = require('./utils')
const logger = require('../providers/logging/logger')

class LicenseMatcher {
  /**
   * 
   * @param {import('./licenseMatcher').IMatchPolicy[]} policies 
   */
  constructor(policies) {
    this._policies = policies || [new DefinitionLicenseMatchPolicy(), new HarvestLicenseMatchPolicy()]
  }

  /**
   * Given two coordinate with different revision, decide whether they have the same license and provide reason
   * @param { import('./licenseMatcher').DefType } source
   * @param { import('./licenseMatcher').DefType } target
   * @return { import('./licenseMatcher').ProcessResult }
   */
  process(source, target) {
    const compareResults = this._policies
      .map(policy => policy.compare(source, target))
      .reduce((acc, cur) => ({ match: acc.match.concat(cur.match), mismatch: acc.mismatch.concat(cur.mismatch) }))
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

class DefinitionLicenseMatchPolicy {
  constructor() {
    this.name = 'definition'
    this._compareProps = ['hashes.sha1', 'hashes.sha256', 'token']
  }

  // When license changed name or path even the content has not be changed,
  // compare will return not match.
  /**
   * 
   * @param {import('./licenseMatcher').DefType} source 
   * @param {import('./licenseMatcher').DefType} target 
   * @returns {import('./licenseMatcher').MatchResults}
   */
  compare(source, target) {
    const fileMap = this._generateFileMap(source, target)
    return this._compareFileInMap(fileMap)
  }

  /**
   * 
   * @param {import('./licenseMatcher').DefType} source 
   * @param {import('./licenseMatcher').DefType} target 
   * @returns {Map<string, any>}
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
   * 
   * @param {Map<string, any>} fileMap 
   * @param {any[]} files 
   * @param {string} propName 
   */
  _addFileToMap(fileMap, files, propName) {
    files &&
      files.forEach(f => {
        if (!f.path) return
        const current = fileMap.get(f.path) || {}
        current[propName] = f
        fileMap.set(f.path, current)
      })
  }

  /**
   * 
   * @param {any} definition 
   * @returns {any[]}
   */
  _getLicenseFile(definition) {
    return definition.files && definition.files.filter((/** @type {{ path: string; }} */ f) => isLicenseFile(f.path, definition.coordinates))
  }

  /**
   * 
   * @param {Map<string, any>} fileMap 
   * @returns {import('./licenseMatcher').MatchResults }
   */
  _compareFileInMap(fileMap) {
    const result = {
      /** @type {import('./licenseMatcher').MatchType[]} */match: [],
      /** @type {import('./licenseMatcher').MismatchType[]} */mismatch: []
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

class HarvestLicenseMatchPolicy {
  /**
  * Compare two definitions for license matches.
  * @param {import('./licenseMatcher').DefType} source 
  * @param {import('./licenseMatcher').DefType} target 
  * @returns {import('./licenseMatcher').MatchResults}
  */
  compare(source, target) {
    const type = source.definition.coordinates.type
    const strategy = this._getStrategy(type)
    return strategy.compare(source, target)
  }

  /**
   * 
   * @param {string} type 
   * @returns {import('./licenseMatcher').IMatchPolicy}
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

class BaseHarvestLicenseMatchStrategy {
  /**
   * 
   * @param {string} type 
   * @param {string[]} propPaths 
   */
  constructor(type, propPaths = []) {
    this.name = 'harvest'
    this.type = type
    this.propPaths = propPaths
  }

  /**
  * Compare two definitions for license matches.
  * @param {import('./licenseMatcher').DefType} source 
  * @param {import('./licenseMatcher').DefType} target 
  * @returns {import('./licenseMatcher').MatchResults}
  */
  compare(source, target) {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
    const result = {
      /** @type {import('./licenseMatcher').MatchType[]} */match: [],
      /** @type {import('./licenseMatcher').MismatchType[]} */mismatch: []
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

class NugetHarvestLicenseMatchStrategy extends BaseHarvestLicenseMatchStrategy {
  constructor() {
    super('nuget', ['manifest.licenseExpression', 'manifest.licenseUrl'])
    this.logger = logger()
    this.excludedLicenseUrl = ['github.com', 'aka.ms/deprecateLicenseUrl']
  }

  /**
   * Compare two definitions for license matches.
   * @param {import('./licenseMatcher').DefType} source
   * @param {import('./licenseMatcher').DefType} target
   * @returns {import('./licenseMatcher').MatchResults}
   * @override
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
      if (m.value && this.excludedLicenseUrl.some(url => m.value.toLowerCase().includes(url.toLowerCase()))) {
        return false
      }
      return true
    })
    return result
  }
}

/**
 * 
 * @param {any} coordinateHarvest 
 * @param {string} tool 
 * @returns {any}
 */
function getLatestToolHarvest(coordinateHarvest, tool) {
  if (!coordinateHarvest[tool]) {
    return
  }
  const latestVersion = getLatestVersion(Object.keys(coordinateHarvest[tool]))
  return get(coordinateHarvest, [tool, latestVersion])
}

module.exports = {
  LicenseMatcher,
  DefinitionLicenseMatchPolicy,
  HarvestLicenseMatchPolicy
}
