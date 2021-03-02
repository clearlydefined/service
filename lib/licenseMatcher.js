const { get, first } = require('lodash')

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
    for (const policy of this._policies) {
      const match = policy.isMatching(source, target);
      if (match.isMatching) {
        return match
      }
    }
    return { isMatching: false }
  }
}

class DefinitionLicenseMatchPolicy {
  constructor() {
    this._policyName = 'definition'
    this._comparePaths = ['hashes.sha1', 'hashes.sha256', 'token']
  }

  isMatching(source, target) {
    const licenseFiles = source.definition.files.filter(f => f.path.toLowerCase().includes('license') || f.path.toLowerCase().includes('copying'))
    if (licenseFiles.length === 0) {
      return false
    }
    for (const file of target.definition.files) {
      for (const path of this._comparePaths) {
        const value = get(file, path)
        const isMatching = licenseFiles.some(licenseFile => noEmptyEqual(get(licenseFile, path), value))
        if (isMatching) {
          const reason = `${source.definition.coordinates.revision} and ${target.definition.coordinates.revision} share the same ${path}, ${value}`
          return {
            isMatching: true,
            policy: this._policyName,
            reason
          }
        }
      }
    }
    return { isMatching: false }
  }
}

class HarvestLicenseMatchPolicy {
  constructor() {
    this._policyName = 'harvest'
    this._compareProps = [
      {
        type: 'npm',
        path: 'registryData.manifest.license'
      }
    ];
  }

  isMatching(source, target) {
    const sourceLatestClearlyDefinedToolHarvest = getLatestToolHarvest(source.harvest, 'clearlydefined')
    const targetLatestClearlyDefinedToolHarvest = getLatestToolHarvest(target.harvest, 'clearlydefined')
    for (const prop of this._compareProps) {
      if (prop.type !== source.definition.coordinates.type) {
        continue
      }
      const sourceLicense = get(sourceLatestClearlyDefinedToolHarvest, prop.path)
      const targetLicense = get(targetLatestClearlyDefinedToolHarvest, prop.path)
      if (noEmptyEqual(sourceLicense, targetLicense)) {
        return {
          isMatching: true,
          policy: this._policyName,
          reason: `${source.definition.coordinates.revision} and ${target.definition.coordinates.revision} share the same ${prop.path}, ${sourceLicense}`
        }
      }
    }
    return { isMatching: false }
  }
}

/**
 * If either source and target is undefined or null, return false. Otherwise, do the ===
 * @param {*} source
 * @param {*} target
 * @return { Boolean }
 */
function noEmptyEqual(source, target) {
  if (!source || !target) {
    return false
  }
  return source === target
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
  LicenseMatcher
}