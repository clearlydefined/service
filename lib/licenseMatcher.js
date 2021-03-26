const { get, isEqual: isDeepEqual } = require('lodash')
const { isLicenseFile, getLatestVersion } = require('./utils')

class LicenseMatcher {
  constructor(policies) {
    this._policies = policies || [new DefinitionLicenseMatchPolicy(), new HarvestLicenseMatchPolicy()]
  }

  /**
   * Given two coordinate with different revision, decide whether they have the same license and provide reason
   * @param { definition, harvest } source
   * @param { definition, harvest } target
   * @return { isMatching: Boolean, match: [] | undefined, mismatch: [] | undefined }
   */
  process(source, target) {
    const compareResults = this._policies.map(policy => policy.compare(source, target))
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
  compare(source, target) {
    const fileMap = this._generateFileMap(source, target)
    return this._compareFileInMap(fileMap)
  }

  _generateFileMap(source, target) {
    const sourceLicenseFiles = this._getLicenseFile(source.definition)
    const targetLicenseFiles = this._getLicenseFile(target.definition)
    const fileMap = new Map()
    this._addFileToMap(fileMap, sourceLicenseFiles, 'sourceFile')
    this._addFileToMap(fileMap, targetLicenseFiles, 'targetFile')
    return fileMap
  }

  _addFileToMap(fileMap, files, propName) {
    files && files.forEach(f => {
      if (!f.path) return
      const current = fileMap.get(f.path) || {}
      current[propName] = f
      fileMap.set(f.path, current)
    })
  }

  _getLicenseFile(definition) {
    return definition.files && definition.files.filter(f => isLicenseFile(f.path, definition.coordinates))
  }

  _compareFileInMap(fileMap) {
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

class HarvestLicenseMatchPolicy {

  compare(source, target) {
    const type = source.definition.coordinates.type
    const strategy = this._getStrategy(type)
    return strategy.compare(source, target)
  }

  _getStrategy(type) {
    switch (type) {
      case 'maven':
        return new BaseHarvestLicenseMatchStrategy('maven', ['manifest.summary.licenses'])
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
  constructor(type, propPaths = []) {
    this.name = 'harvest'
    this.type = type
    this.propPaths = propPaths
  }

  compare(source, target) {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
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

class NugetHarvestLicenseMatchStrategy extends BaseHarvestLicenseMatchStrategy {
  constructor() {
    super('nuget', ['manifest.licenseExpression', 'manifest.licenseUrl'])
  }

  compare(source, target) {
    const result = super.compare(source, target)
    // For Nuget component, if the licenseUrl point to github,
    // the content of the license url is tend to change even the url keeps the same
    result.match = result.match.filter(m => {
      if (m.value && m.value.toLowerCase().includes('github.com')) {
        return false
      }
      return true
    })
    return result
  }
}

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