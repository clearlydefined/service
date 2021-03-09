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
   * @return { isMatching: Boolean, reason: String | undefined, policy: String | undefined }
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
    files.forEach(f => {
      if (!f.path) return
      const current = fileMap.get(f.path) || {}
      current[propName] = f
      fileMap.set(f.path, current)
    })
  }

  _getLicenseFile(definition) {
    return definition.files.filter(f => isLicenseFile(f.path, definition.coordinates))
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
  constructor() {
    this.name = 'harvest'
  }

  compare(source, target) {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
    const result = {
      match: [],
      mismatch: []
    }
    const propPaths = this._getComparePropPaths(source)
    for (const propPath of propPaths) {
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

  _getComparePropPaths(source) {
    const type = source.definition.coordinates.type
    switch (type) {
      case 'maven':
        return ['manifest.summary.licenses']
      case 'crate':
      case 'pod':
        return ['registryData.license']
      case 'nuget':
        return ['manifest.licenseExpression', 'manifest.licenseUrl']
      case 'npm':
      case 'composer':
        return ['registryData.manifest.license']
      case 'gem':
        return ['registryData.licenses']
      case 'pypi':
        return ['declaredLicense', 'registryData.info.license']
      case 'deb':
      case 'debsrc':
        return ['declaredLicenses']
      default:
        return []
    }
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