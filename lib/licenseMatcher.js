const { get, first, isEqual: isDeepEqual } = require('lodash')
const { isLicenseFile } = require('./utils')

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

  compare(source, target) {
    const sourceLicenseFiles = source.definition.files.filter(f => isLicenseFile(f.path, source.definition.coordinates))
    const targetLicenseFiles = target.definition.files.filter(f => isLicenseFile(f.path, target.definition.coordinates))
    const result = {
      match: [],
      mismatch: []
    }
    for (const propPath of this._compareProps) {
      for (const sourceFile of sourceLicenseFiles) {
        const sourceValue = get(sourceFile, propPath)
        for (const targetFile of targetLicenseFiles) {
          const targetValue = get(targetFile, propPath)
          if (!sourceValue && !targetValue) {
            continue
          }
          if (sourceValue === targetValue) {
            result.match.push({
              policy: this.name,
              propPath,
              value: sourceValue
            })
          } else {
            result.mismatch.push({
              policy: this.name,
              propPath,
              source: sourceValue,
              target: targetValue
            })
          }
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
    const type = source.definition.coordinates.type;
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
  const sortedVersions = Object.keys(coordinateHarvest[tool]).sort((a, b) => semver.gt(a, b) ? -1 : 1)
  const latestVersion = first(sortedVersions)
  return get(coordinateHarvest, [tool, latestVersion])
}

module.exports = {
  LicenseMatcher,
  DefinitionLicenseMatchPolicy,
  HarvestLicenseMatchPolicy
}