// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { get, set, isArray, uniq, cloneDeep, flatten, find } = require('lodash')
const SPDX = require('@clearlydefined/spdx')
const {
  extractDate,
  setIfValue,
  extractLicenseFromLicenseUrl,
  buildSourceUrl,
  isDeclaredLicense,
  isLicenseFile,
  updateSourceLocation,
  mergeDefinitions
} = require('../../lib/utils')

class ClearlyDescribedSummarizer {
  constructor(options) {
    this.options = options
  }

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

  addSummaryInfo(result, data) {
    setIfValue(result, 'described.hashes', get(data, 'summaryInfo.hashes'))
    setIfValue(result, 'described.files', get(data, 'summaryInfo.count'))
  }

  addFacetInfo(result, data) {
    setIfValue(result, 'described.facets', data.facets)
  }

  addSourceLocation(result, data) {
    if (!data.sourceInfo) return
    const spec = data.sourceInfo
    updateSourceLocation(spec)
    spec.url = buildSourceUrl(spec)
    set(result, 'described.sourceLocation', spec)
  }

  addFiles(result, data) {
    if (!data.files) return
    result.files = data.files.map(file => {
      return { path: file.path, hashes: file.hashes }
    })
  }

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
   */
  addInterestingFiles(result, data, coordinates) {
    if (!data.interestingFiles) return
    const newDefinition = cloneDeep(result)
    const newFiles = cloneDeep(data.interestingFiles)
    newFiles.forEach(file => {
      file.license = SPDX.normalize(file.license)
      if (!file.license) delete file.license
      else if (isLicenseFile(file.path, coordinates)) file.natures = uniq((file.natures || []).concat(['license']))
    })
    set(newDefinition, 'files', newFiles)
    mergeDefinitions(result, newDefinition)
  }

  /**
   * Deprecated in favor of attachments from when licensee was a part of the CD tool
   * TODO: remove when interestingFiles is no longer in harvested data
   */
  addLicenseFromFiles(result, data, coordinates) {
    if (!data.interestingFiles) return
    const licenses = data.interestingFiles
      .map(file => (isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }

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
        urls.registry = `https://repo1.maven.org/maven2/${namespaceAsFolders}/${coordinates.name}`
        urls.download = `https://repo1.maven.org/maven2/${namespaceAsFolders}/${coordinates.name}/${coordinates.revision}/${coordinates.name}-${coordinates.revision}.jar`
    }

    return urls
  }

  addMavenData(result, data, coordinates) {
    const urls = this.getMavenUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      urls.registry
    )
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      urls.download
    )
    const projectSummaryLicenses =
      get(data, 'manifest.summary.licenses') || get(data, 'manifest.summary.project.licenses') // the project layer was removed in 1.2.0
    if (!projectSummaryLicenses) return
    const licenseSummaries = flatten(projectSummaryLicenses.map(x => x.license)).filter(x => x)
    const licenseUrls = uniq([
      ...flatten(licenseSummaries.map(license => license.url)),
      ...flatten(projectSummaryLicenses.map(x => x.url))
    ]).filter(x => x)
    const licenseNames = uniq(flatten(licenseSummaries.map(license => license.name)))
    let licenses = licenseUrls.map(extractLicenseFromLicenseUrl).filter(x => x)
    if (!licenses.length) licenses = licenseNames.map(x => SPDX.lookupByName(x) || x).filter(x => x)
    if (licenses.length) setIfValue(result, 'licensed.declared', SPDX.normalize(licenses.join(' OR ')))
  }

  addCrateData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(get(data, 'registryData.created_at')))
    setIfValue(result, 'described.projectWebsite', get(data, 'manifest.homepage'))
    const license = get(data, 'registryData.license')
    if (license) setIfValue(result, 'licensed.declared', SPDX.normalize(license.split('/').join(' OR ')))
    setIfValue(result, 'described.urls.registry', `https://crates.io/crates/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://crates.io/api/v1/crates/${coordinates.name}/${coordinates.revision}/download`
    )
  }

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
  }

  addNuGetData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const licenseExpression = SPDX.normalize(get(data, 'manifest.licenseExpression'))
    const licenseUrl = get(data, 'manifest.licenseUrl')
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
    const packageEntries = get(data, 'manifest.packageEntries')
    if (!packageEntries) return
    const newDefinition = cloneDeep(result)
    newDefinition.files = packageEntries.map(file => {
      return { path: file.fullName }
    })
    mergeDefinitions(result, newDefinition, get(result, 'licensed.declared') === 'OTHER')
  }

  parseLicenseExpression(manifest, packageType) {
    const combineLicenses = (exp, license) => {
      if (exp) {
        return exp + ' ' + (packageType === 'npm' ? 'AND' : 'OR') + ' ' + stringObjectArray(license)
      }
      return stringObjectArray(license)
    }
    const stringObjectArray = value => {
      if (!value) {
        return null
      } else if (typeof value === 'string') {
        return value
      } else if (Array.isArray(value)) {
        return value.reduce(combineLicenses, null)
      } else if (typeof value.type == 'string') {
        return value.type
      } else if (Array.isArray(value.type)) {
        return value.type.reduce(combineLicenses, null)
      }
      return null
    }
    return stringObjectArray(manifest.license) || (packageType === 'npm' && stringObjectArray(manifest.licenses))
  }

  addNpmData(result, data, coordinates) {
    if (!data.registryData) return
    setIfValue(result, 'described.releaseDate', extractDate(data.registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://npmjs.com/package/${coordinates.namespace ? coordinates.namespace + '/' + coordinates.name : coordinates.name
      }`
    )
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/v/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://registry.npmjs.com/${coordinates.namespace ? coordinates.namespace + '/' + coordinates.name : coordinates.name
      }/-/${coordinates.name}-${coordinates.revision}.tgz`
    )
    const manifest = get(data, 'registryData.manifest')
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

  addComposerData(result, data, coordinates) {
    if (!data.registryData) return
    setIfValue(result, 'described.releaseDate', extractDate(data.registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://packagist.org/packages/${coordinates.namespace + '/' + coordinates.name}`
    )
    const manifest = get(data, 'registryData.manifest')
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

  addPodData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.homepage'))
    const license = get(data, 'registryData.license')
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
      const revision = get(data, 'registryData.sourceInfo.revision')
      if (homepage && revision) {
        setIfValue(result, 'described.urls.version', `${homepage}/tree/${revision}`)
        setIfValue(result, 'described.urls.download', `${homepage}/archive/${revision}.zip`)
      }
    }
  }

  addGemData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const license = SPDX.normalize(get(data, 'registryData.license'))
    if (license) set(result, 'licensed.declared', license)
    else {
      const licenses = SPDX.normalize((get(data, 'registryData.licenses') || []).join(' OR '))
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

  addPyPiData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data.declaredLicense)
    setIfValue(result, 'described.urls.registry', `https://pypi.org/project/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    // TODO: we are currently picking the first url that contains a tar.gz or zip extension
    // we should understand what's the correct process on a pypi definition that contains multiple object for the same release
    const releases = get(data, 'registryData.releases')
    if (releases) {
      const revision = find(releases[coordinates.revision], revision =>
        revision.filename ? revision.filename.includes('tar.gz') || revision.filename.includes('zip') : false
      )
      if (revision) setIfValue(result, 'described.urls.download', revision.url)
    }
  }

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

  addGitData(result, data, coordinates) {
    const urls = this.getGitUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(
      result,
      'described.urls.version',
      urls.version
    )
    setIfValue(
      result,
      'described.urls.download',
      urls.download
    )
  }

  addDebData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) return
    const registryUrl = this.getDebianRegistryUrl(data.registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      if (result.described.sourceLocation) {
        result.described.sourceLocation.url = registryUrl
      }
    }
    const architecture = coordinates.revision.split('_')[1]
    const downloadUrl = new URL(
      'http://ftp.debian.org/debian/' + data.registryData.find(entry => entry.Architecture === architecture).Path
    ).href
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  addDebSrcData(result, data, coordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) return
    const registryUrl = this.getDebianRegistryUrl(data.registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      result.described.sourceLocation = { ...coordinates, url: registryUrl }
    }
    const downloadUrl = new URL(
      'http://ftp.debian.org/debian/' + data.registryData.find(entry => entry.Path.includes('.orig.tar.')).Path
    ).href
    // There is also patches URL which is related to sources but it's not part of the schema
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  getDebianRegistryUrl(registryData) {
    const registryPath = registryData[0].Path
    if (registryPath) {
      // Example: ./pool/main/0/0ad/0ad_0.0.17-1.debian.tar.xz -> http://ftp.debian.org/debian/pool/main/0/0ad
      const pathName = registryPath
        .split('/')
        .slice(1, 5)
        .join('/')
      return 'http://ftp.debian.org/debian/' + pathName
    }
    return null
  }

  addGoData(result, data, coordinates) {
    var urls = { download: '', registry: '', version: '' }

    urls.registry = `https://pkg.go.dev/${coordinates.namespace}/${coordinates.name}`
    urls.download = `https://proxy.golang.org/${coordinates.namespace}/${coordinates.name}/@v/${coordinates.revision}.zip`
    urls.version = `https://pkg.go.dev/${coordinates.namespace}/${coordinates.name}@${coordinates.revision}`

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      urls.registry
    )
    setIfValue(result, 'described.urls.version', urls.version)
    setIfValue(
      result,
      'described.urls.download',
      urls.download
    )
  }
}

module.exports = options => new ClearlyDescribedSummarizer(options)
