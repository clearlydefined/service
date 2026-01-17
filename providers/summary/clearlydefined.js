// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * @typedef {import('./index').SummarizerOptions} SummarizerOptions
 * @typedef {import('./clearlydefined').ClearlyDefinedHarvestedData} ClearlyDefinedHarvestedData
 * @typedef {import('./clearlydefined').SummaryResult} SummaryResult
 * @typedef {import('./clearlydefined').ComponentUrls} ComponentUrls
 * @typedef {import('./clearlydefined').DebianRegistryEntry} DebianRegistryEntry
 * @typedef {import('./clearlydefined').NpmManifest} NpmManifest
 * @typedef {import('./clearlydefined').ComposerManifest} ComposerManifest
 * @typedef {import('./clearlydefined').MavenLicenseInfo} MavenLicenseInfo
 * @typedef {import('../../lib/entityCoordinates')} EntityCoordinates
 * @typedef {import('../../lib/utils').FileEntry} FileEntry
 */

const { get, set, isArray, uniq, cloneDeep, flatten, find } = require('lodash')
const SPDX = require('@clearlydefined/spdx')
const {
  extractDate,
  setIfValue,
  extractLicenseFromLicenseUrl,
  buildSourceUrl,
  isDeclaredLicense,
  isLicenseFile,
  deCodeSlashes,
  updateSourceLocation,
  mergeDefinitions
} = require('../../lib/utils')

/** @type {Record<string, string>} */
const mavenBasedUrls = {
  mavencentral: 'https://repo1.maven.org/maven2',
  gradleplugin: 'https://plugins.gradle.org/m2'
}

/** @type {Record<string, string>} */
const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

/**
 * ClearlyDefined summarizer class that processes harvested data from the ClearlyDefined tool.
 * Handles summarization for multiple package types including npm, maven, nuget, gem, etc.
 * @class
 */
class ClearlyDescribedSummarizer {
  /**
   * Creates a new ClearlyDescribedSummarizer instance
   * @param {SummarizerOptions} options - Configuration options for the summarizer
   */
  constructor(options) {
    this.options = options
  }

  /**
   * Summarize the raw information related to the given coordinates.
   * @param {EntityCoordinates} coordinates - The entity for which we are summarizing
   * @param {ClearlyDefinedHarvestedData} data - The set of raw tool outputs related to the identified entity
   * @returns {SummaryResult} A summary of the given raw information
   */
  summarize(coordinates, data) {
    const result = {}
    this.addFacetInfo(result, data)
    this.addSourceLocation(result, data)
    this.addSummaryInfo(result, data)
    this.addFiles(result, data)
    this.addAttachedFiles(result, data, coordinates)
    this.addInterestingFiles(result, data, coordinates)
    this.addLicenseFromFiles(result, data, coordinates)
    switch (coordinates.type) {
      case 'git':
        this.addGitData(result, data, coordinates)
        break
      case 'go':
        this.addGoData(result, data, coordinates)
        break
      case 'npm':
        this.addNpmData(result, data, coordinates)
        break
      case 'conda':
        this.addCondaData(result, data, coordinates)
        break
      case 'condasrc':
        this.addCondaSrcData(result, data, coordinates)
        break
      case 'crate':
        this.addCrateData(result, data, coordinates)
        break
      case 'maven':
        this.addMavenData(result, data, coordinates)
        break
      case 'sourcearchive':
        this.addSourceArchiveData(result, data, coordinates)
        break
      case 'nuget':
        this.addNuGetData(result, data, coordinates)
        break
      case 'composer':
        this.addComposerData(result, data, coordinates)
        break
      case 'gem':
        this.addGemData(result, data, coordinates)
        break
      case 'pod':
        this.addPodData(result, data, coordinates)
        break
      case 'pypi':
        this.addPyPiData(result, data, coordinates)
        break
      case 'deb':
        this.addDebData(result, data, coordinates)
        break
      case 'debsrc':
        this.addDebSrcData(result, data, coordinates)
        break
      default:
    }
    return result
  }

  /**
   * Adds summary info (hashes and file count) to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   */
  addSummaryInfo(result, data) {
    setIfValue(result, 'described.hashes', get(data, 'summaryInfo.hashes'))
    setIfValue(result, 'described.files', get(data, 'summaryInfo.count'))
  }

  /**
   * Adds facet information to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   */
  addFacetInfo(result, data) {
    setIfValue(result, 'described.facets', data.facets)
  }

  /**
   * Adds source location to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   */
  addSourceLocation(result, data) {
    if (!data.sourceInfo) return
    const spec = data.sourceInfo
    updateSourceLocation(spec)
    spec.url = buildSourceUrl(spec)
    set(result, 'described.sourceLocation', spec)
  }

  /**
   * Adds file information to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   */
  addFiles(result, data) {
    if (!data.files) return
    result.files = data.files.map(file => {
      return { path: file.path, hashes: file.hashes }
    })
  }

  /**
   * Adds attached file information (tokens) to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addAttachedFiles(result, data, coordinates) {
    if (!data.attachments || !result.files) return
    data.attachments.forEach(file => {
      const existing = result.files.find(entry => entry.path === file.path)
      if (!existing) return
      existing.token = file.token
      if (isLicenseFile(file.path, coordinates)) existing.natures = uniq((existing.natures || []).concat(['license']))
    })
  }

  /**
   * Deprecated in favor of attachments from when licensee was a part of the CD tool
   * TODO: remove when interestingFiles is no longer in harvested data
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addInterestingFiles(result, data, coordinates) {
    if (!data.interestingFiles) return
    const newDefinition = cloneDeep(result)
    const newFiles = cloneDeep(data.interestingFiles)
    newFiles.forEach(
      /** @param {{ license?: string; path: string; natures?: string[] }} file */ file => {
        file.license = SPDX.normalize(file.license)
        if (!file.license) delete file.license
        else if (isLicenseFile(file.path, coordinates)) file.natures = uniq((file.natures || []).concat(['license']))
      }
    )
    set(newDefinition, 'files', newFiles)
    mergeDefinitions(result, newDefinition)
  }

  /**
   * Deprecated in favor of attachments from when licensee was a part of the CD tool
   * TODO: remove when interestingFiles is no longer in harvested data
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addLicenseFromFiles(result, data, coordinates) {
    if (!data.interestingFiles) return
    const licenses = data.interestingFiles
      .map(
        /** @param {{ license?: string; path: string }} file */
        file => (isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null)
      )
      .filter(/** @param {unknown} x */ x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }

  /**
   * Gets Maven registry and download URLs for the given coordinates
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {ComponentUrls} Object containing download and registry URLs
   */
  getMavenUrls(coordinates) {
    var urls = { download: '', registry: '' }
    const namespaceAsFolders = coordinates.namespace ? coordinates.namespace.replace(/\./g, '/') : coordinates.namespace

    switch (coordinates.provider) {
      //For Google's Maven Repo, the artifacts do not always have the same format and sometimes are missing. We are simply providing link for the package info and let the user
      //decide on what to download
      case 'mavengoogle':
        urls.registry = `https://maven.google.com/web/index.html#${coordinates.namespace}:${coordinates.name}:${coordinates.revision}`
        urls.download = `https://maven.google.com/web/index.html#${coordinates.namespace}:${coordinates.name}:${coordinates.revision}`
        break

      default:
        urls.registry = `${mavenBasedUrls[coordinates.provider]}/${namespaceAsFolders}/${coordinates.name}`
        urls.download = `${mavenBasedUrls[coordinates.provider]}/${namespaceAsFolders}/${coordinates.name}/${coordinates.revision}/${coordinates.name}-${coordinates.revision}.jar`
    }

    return urls
  }

  /**
   * Extracts declared license from Maven manifest data
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @returns {string[] | undefined} Array of license identifiers or undefined
   */
  getDeclaredLicenseMaven(data) {
    const projectSummaryLicenses = /** @type {MavenLicenseInfo[] | undefined} */ (
      get(data, 'manifest.summary.licenses') || get(data, 'manifest.summary.project.licenses')
    ) // the project layer was removed in 1.2.0
    if (!projectSummaryLicenses) return undefined
    const licenseSummaries = /** @type {MavenLicenseInfo[]} */ (
      flatten(projectSummaryLicenses.map(/** @param {MavenLicenseInfo} x */ x => x.license)).filter(
        /** @param {unknown} x */ x => x
      )
    )
    const licenseUrls = uniq([
      ...flatten(licenseSummaries.map(/** @param {MavenLicenseInfo} license */ license => license.url)),
      ...flatten(projectSummaryLicenses.map(/** @param {MavenLicenseInfo} x */ x => x.url))
    ]).filter(/** @param {unknown} x */ x => x)
    const licenseNames = uniq(
      flatten(licenseSummaries.map(/** @param {MavenLicenseInfo} license */ license => license.name))
    )
    let licenses = licenseUrls
      .map(/** @param {string} url */ url => extractLicenseFromLicenseUrl(url))
      .filter(/** @param {unknown} x */ x => x)
    if (!licenses.length)
      licenses = licenseNames
        .map(/** @param {string} x */ x => SPDX.lookupByName(x) || x)
        .filter(/** @param {unknown} x */ x => x)
    return licenses
  }

  /**
   * Adds Maven data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addMavenData(result, data, coordinates) {
    const urls = this.getMavenUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(result, 'described.urls.download', urls.download)
    const licenses = this.getDeclaredLicenseMaven(data)
    if (licenses?.length) setIfValue(result, 'licensed.declared', SPDX.normalize(licenses.join(' OR ')))
  }

  /**
   * Adds Conda data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addCondaData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(get(data, 'releaseDate')))
    setIfValue(result, 'described.urls.download', get(data, 'registryData.downloadUrl'))
    setIfValue(result, 'described.urls.registry', new URL(`${condaChannels[coordinates.provider]}`).href)
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.channelData.home'))
    const condaLicense = Array.isArray(data.declaredLicenses)
      ? data.declaredLicenses.join(' AND ')
      : data.declaredLicenses
    setIfValue(result, 'licensed.declared', SPDX.normalize(condaLicense))
  }

  /**
   * Adds CondaSrc data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addCondaSrcData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.download', get(data, 'registryData.channelData.source_url'))
    setIfValue(result, 'described.urls.registry', new URL(`${condaChannels[coordinates.provider]}`).href)
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.channelData.home'))
    const condaSrcLicense = Array.isArray(data.declaredLicenses)
      ? data.declaredLicenses.join(' AND ')
      : data.declaredLicenses
    setIfValue(result, 'licensed.declared', SPDX.normalize(condaSrcLicense))
  }

  /**
   * Adds Crate data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addCrateData(result, data, coordinates) {
    setIfValue(
      result,
      'described.releaseDate',
      extractDate(/** @type {string | undefined} */ (get(data, 'registryData.created_at')))
    )
    setIfValue(result, 'described.projectWebsite', get(data, 'manifest.homepage'))
    const license = /** @type {string | undefined} */ (get(data, 'registryData.license'))
    if (license) setIfValue(result, 'licensed.declared', SPDX.normalize(license.split('/').join(' OR ')))
    setIfValue(result, 'described.urls.registry', `https://crates.io/crates/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://crates.io/api/v1/crates/${coordinates.name}/${coordinates.revision}/download`
    )
  }

  /**
   * Adds Source Archive data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addSourceArchiveData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const namespaceAsFolders = coordinates.namespace ? coordinates.namespace.replace(/\./g, '/') : coordinates.namespace
    setIfValue(
      result,
      'described.urls.registry',
      `https://repo1.maven.org/maven2/${namespaceAsFolders}/${coordinates.name}`
    )
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://repo1.maven.org/maven2/${namespaceAsFolders}/${coordinates.name}/${coordinates.revision}/${coordinates.name}-${coordinates.revision}.jar`
    )
    const licenses = this.getDeclaredLicenseMaven(data)
    if (licenses?.length) setIfValue(result, 'licensed.declared', SPDX.normalize(licenses.join(' OR ')))
  }

  /**
   * Adds NuGet data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addNuGetData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const licenseExpression = SPDX.normalize(
      /** @type {string | undefined} */ (get(data, 'manifest.licenseExpression'))
    )
    const licenseUrl = /** @type {string | undefined} */ (get(data, 'manifest.licenseUrl'))
    if (licenseExpression) set(result, 'licensed.declared', licenseExpression)
    else if (licenseUrl && licenseUrl.trim())
      set(result, 'licensed.declared', extractLicenseFromLicenseUrl(licenseUrl) || 'NOASSERTION')
    setIfValue(result, 'described.urls.registry', `https://nuget.org/packages/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://nuget.org/api/v2/package/${coordinates.name}/${coordinates.revision}`
    )
    const packageEntries = /** @type {{ fullName: string }[] | undefined} */ (get(data, 'manifest.packageEntries'))
    if (!packageEntries) return
    const newDefinition = cloneDeep(result)
    newDefinition.files = packageEntries.map(
      /** @param {{ fullName: string }} file */ file => {
        return { path: file.fullName }
      }
    )
    mergeDefinitions(result, newDefinition, get(result, 'licensed.declared') === 'OTHER')
  }

  /**
   * Parses license expression from manifest, handling various formats
   * @param {NpmManifest | ComposerManifest} manifest - The package manifest
   * @param {string} packageType - The type of package ('npm', 'composer', etc.)
   * @returns {string | null} Parsed license expression or null
   */
  parseLicenseExpression(manifest, packageType) {
    /**
     * @param {string | null} exp
     * @param {unknown} license
     * @returns {string | null}
     */
    const combineLicenses = (exp, license) => {
      if (exp) {
        return exp + ' ' + (packageType === 'npm' ? 'AND' : 'OR') + ' ' + stringObjectArray(license)
      }
      return stringObjectArray(license)
    }
    /**
     * @param {unknown} value
     * @returns {string | null}
     */
    const stringObjectArray = value => {
      if (!value) {
        return null
      } else if (typeof value === 'string') {
        return value
      } else if (Array.isArray(value)) {
        return value.reduce(combineLicenses, null)
      } else if (typeof (/** @type {{ type?: unknown }} */ (value).type) == 'string') {
        return /** @type {{ type: string }} */ (value).type
      } else if (Array.isArray(/** @type {{ type?: unknown }} */ (value).type)) {
        return /** @type {{ type: unknown[] }} */ (value).type.reduce(combineLicenses, null)
      }
      return null
    }
    return (
      stringObjectArray(manifest.license) ||
      (packageType === 'npm' && stringObjectArray(/** @type {NpmManifest} */ (manifest).licenses))
    )
  }

  /**
   * Adds NPM data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addNpmData(result, data, coordinates) {
    if (!data.registryData) return
    const registryData = /** @type {import('./clearlydefined').NpmRegistryData} */ (data.registryData)
    setIfValue(result, 'described.releaseDate', extractDate(registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://npmjs.com/package/${
        coordinates.namespace ? coordinates.namespace + '/' + coordinates.name : coordinates.name
      }`
    )
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/v/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://registry.npmjs.com/${
        coordinates.namespace ? coordinates.namespace + '/' + coordinates.name : coordinates.name
      }/-/${coordinates.name}-${coordinates.revision}.tgz`
    )
    const manifest = registryData.manifest
    if (!manifest) return
    let homepage = manifest.homepage
    if (homepage && isArray(homepage)) homepage = homepage[0]
    setIfValue(result, 'described.projectWebsite', homepage)
    const bugs = manifest.bugs
    if (bugs) {
      if (typeof bugs === 'string') {
        if (bugs.startsWith('http')) setIfValue(result, 'described.issueTracker', bugs)
      } else setIfValue(result, 'described.issueTracker', bugs.url || bugs.email)
    }
    const expression = this.parseLicenseExpression(manifest, 'npm')
    if (!expression) return
    setIfValue(result, 'licensed.declared', SPDX.normalize(expression))
  }

  /**
   * Adds Composer data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addComposerData(result, data, coordinates) {
    if (!data.registryData) return
    const registryData = /** @type {import('./clearlydefined').ComposerRegistryData} */ (data.registryData)
    setIfValue(result, 'described.releaseDate', extractDate(registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://packagist.org/packages/${coordinates.namespace + '/' + coordinates.name}`
    )
    const manifest = registryData.manifest
    if (!manifest) return
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}#${manifest.version}`)
    setIfValue(result, 'described.projectWebsite', manifest.homepage)
    if (manifest.dist && manifest.dist.url) {
      setIfValue(result, 'described.urls.download', manifest.dist.url)
    }
    const expression = this.parseLicenseExpression(manifest, 'composer')
    if (!expression) return
    setIfValue(result, 'licensed.declared', SPDX.normalize(expression))
  }

  /**
   * Adds Pod data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addPodData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.homepage'))
    const license = /** @type {string | { type?: string } | undefined} */ (get(data, 'registryData.license'))
    if (license) {
      setIfValue(result, 'licensed.declared', SPDX.normalize(typeof license === 'string' ? license : license.type))
    }

    setIfValue(result, 'described.urls.registry', `https://cocoapods.org/pods/${coordinates.name}`)
    const httpSource = get(data, 'registryData.source.http')
    const gitSource = get(data, 'registryData.source.git')
    if (httpSource) {
      setIfValue(result, 'described.urls.download', httpSource)
    } else if (gitSource) {
      const homepage = get(data, 'registryData.homepage')
      const revision = get(data, 'sourceInfo.revision')
      if (homepage && revision) {
        setIfValue(result, 'described.urls.version', `${homepage}/tree/${revision}`)
        setIfValue(result, 'described.urls.download', `${homepage}/archive/${revision}.zip`)
      }
    }
  }

  /**
   * Adds Gem data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addGemData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const license = SPDX.normalize(/** @type {string | undefined} */ (get(data, 'registryData.license')))
    if (license) set(result, 'licensed.declared', license)
    else {
      const gemLicenses = /** @type {string[] | undefined} */ (get(data, 'registryData.licenses')) || []
      const licenses = SPDX.normalize(gemLicenses.join(' OR '))
      setIfValue(result, 'licensed.declared', licenses)
    }
    setIfValue(result, 'described.urls.registry', `https://rubygems.org/gems/${coordinates.name}`)
    setIfValue(
      result,
      'described.urls.version',
      `${get(result, 'described.urls.registry')}/versions/${coordinates.revision}`
    )
    setIfValue(
      result,
      'described.urls.download',
      `https://rubygems.org/downloads/${coordinates.name}-${coordinates.revision}.gem`
    )
  }

  /**
   * Adds PyPi data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addPyPiData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data['declaredLicense'])
    setIfValue(result, 'described.urls.registry', `https://pypi.org/project/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    // TODO: we are currently picking the first url that contains a tar.gz or zip extension
    // we should understand what's the correct process on a pypi definition that contains multiple object for the same release
    const releases = /** @type {Record<string, { filename?: string; url?: string }[]> | undefined} */ (
      get(data, 'registryData.releases')
    )
    if (releases) {
      const revision = find(releases[coordinates.revision], revision =>
        revision.filename ? revision.filename.includes('tar.gz') || revision.filename.includes('zip') : false
      )
      if (revision) setIfValue(result, 'described.urls.download', revision.url)
    }
  }

  /**
   * Gets Git registry, download, and version URLs for the given coordinates
   * @param {EntityCoordinates} coordinates - The entity coordinates
   * @returns {ComponentUrls} Object containing download, registry, and version URLs
   */
  getGitUrls(coordinates) {
    var urls = { download: '', registry: '', version: '' }
    const namespaceAsFolders = coordinates.namespace ? coordinates.namespace.replace(/\./g, '/') : coordinates.namespace

    switch (coordinates.provider) {
      // GitLab allows multiple namespaces in a url
      case 'gitlab':
        urls.registry = `https://gitlab.com/${namespaceAsFolders}/${coordinates.name}`
        urls.download = `https://gitlab.com/${namespaceAsFolders}/${coordinates.name}/-/archive/${coordinates.revision}/${coordinates.name}-${coordinates.revision}.zip`
        urls.version = `https://gitlab.com/${namespaceAsFolders}/${coordinates.name}/-/tree/${coordinates.revision}`
        break

      default:
        urls.registry = `https://github.com/${coordinates.namespace}/${coordinates.name}`
        urls.download = `https://github.com/${coordinates.namespace}/${coordinates.name}/archive/${coordinates.revision}.zip`
        urls.version = `https://github.com/${coordinates.namespace}/${coordinates.name}/tree/${coordinates.revision}`
    }

    return urls
  }

  /**
   * Adds Git data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addGitData(result, data, coordinates) {
    const urls = this.getGitUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', urls.version)
    setIfValue(result, 'described.urls.download', urls.download)
  }

  /**
   * Adds Debian data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addDebData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) return
    const registryData = /** @type {DebianRegistryEntry[]} */ (data.registryData)
    const registryUrl = this.getDebianRegistryUrl(registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      if (result.described.sourceLocation) {
        result.described.sourceLocation.url = registryUrl
      }
    }
    const architecture = coordinates.revision.split('_')[1]
    const downloadUrl = new URL(
      'http://ftp.debian.org/debian/' +
        registryData.find(/** @param {DebianRegistryEntry} entry */ entry => entry.Architecture === architecture).Path
    ).href
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  /**
   * Adds Debian source data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addDebSrcData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) return
    const registryData = /** @type {DebianRegistryEntry[]} */ (data.registryData)
    const registryUrl = this.getDebianRegistryUrl(registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      result.described.sourceLocation = { ...coordinates, url: registryUrl }
    }
    const downloadUrl = new URL(
      'http://ftp.debian.org/debian/' +
        registryData.find(/** @param {DebianRegistryEntry} entry */ entry => entry.Path.includes('.orig.tar.')).Path
    ).href
    // There is also patches URL which is related to sources but it's not part of the schema
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  /**
   * Gets the Debian registry URL from registry data
   * @param {DebianRegistryEntry[]} registryData - The registry data entries
   * @returns {string | null} Registry URL or null
   */
  getDebianRegistryUrl(registryData) {
    const registryPath = registryData[0].Path
    if (registryPath) {
      // Example: ./pool/main/0/0ad/0ad_0.0.17-1.debian.tar.xz -> http://ftp.debian.org/debian/pool/main/0/0ad
      const pathName = registryPath.split('/').slice(1, 5).join('/')
      return 'http://ftp.debian.org/debian/' + pathName
    }
    return null
  }

  /**
   * Adds Go data to the result
   * @param {SummaryResult} result - The result object to modify
   * @param {ClearlyDefinedHarvestedData} data - The harvested data
   * @param {EntityCoordinates} coordinates - The entity coordinates
   */
  addGoData(result, data, coordinates) {
    var urls = { download: '', registry: '', version: '' }

    const namespaceAsFolders = coordinates.namespace ? deCodeSlashes(coordinates.namespace) : coordinates.namespace

    urls.registry = `https://pkg.go.dev/${namespaceAsFolders}/${coordinates.name}`
    urls.download = `https://proxy.golang.org/${namespaceAsFolders}/${coordinates.name}/@v/${coordinates.revision}.zip`
    urls.version = `https://pkg.go.dev/${namespaceAsFolders}/${coordinates.name}@${coordinates.revision}`

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', urls.version)
    setIfValue(result, 'described.urls.download', urls.download)
    const licenses = /** @type {string[]} */ (get(data, 'registryData.licenses')) || []
    // Based on the https://pkg.go.dev/license-policy and github.com/google/licensecheck,
    // ',' means use AND logic.
    const andClause = ' AND '
    const declaredLicense = licenses
      .map(/** @param {string} license */ license => license.replace(/, /g, andClause))
      .join(andClause)
    setIfValue(result, 'licensed.declared', SPDX.normalize(declaredLicense))
  }
}

/**
 * Factory function that creates a ClearlyDescribedSummarizer instance
 * @param {SummarizerOptions} [options] - Configuration options for the summarizer
 * @returns {ClearlyDescribedSummarizer} A new ClearlyDescribedSummarizer instance
 */
module.exports = options => new ClearlyDescribedSummarizer(options)
