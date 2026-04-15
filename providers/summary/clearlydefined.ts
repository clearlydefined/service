// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { FileEntry, SourceLocationSpec } from '../../lib/utils.ts'
import type { SummarizerOptions } from './index.ts'

const { get, set, isArray, uniq, cloneDeep, flatten, find } = lodash

import SPDX from '@clearlydefined/spdx'
import {
  buildSourceUrl,
  deCodeSlashes,
  extractDate,
  extractLicenseFromLicenseUrl,
  isDeclaredLicense,
  isLicenseFile,
  mergeDefinitions,
  setIfValue,
  updateSourceLocation
} from '../../lib/utils.ts'

/** Registry entry for Debian packages */
export interface DebianRegistryEntry {
  Architecture?: string
  Path: string
  [key: string]: unknown
}

/** Registry data for Conda packages */
export interface CondaRegistryData {
  downloadUrl?: string
  channelData?: {
    home?: string
    source_url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Registry data for NPM packages */
export interface NpmRegistryData {
  releaseDate?: string
  manifest?: NpmManifest
  [key: string]: unknown
}

/** NPM package manifest */
export interface NpmManifest {
  license?: string | string[] | { type: string } | { type: string[] }
  licenses?: string | string[] | { type: string } | { type: string[] }
  homepage?: string | string[]
  bugs?: string | { url?: string; email?: string }
  [key: string]: unknown
}

/** Registry data for Composer packages */
export interface ComposerRegistryData {
  releaseDate?: string
  manifest?: ComposerManifest
  [key: string]: unknown
}

/** Composer package manifest */
export interface ComposerManifest {
  license?: string | string[] | { type: string } | { type: string[] }
  homepage?: string
  version?: string
  dist?: { url?: string }
  [key: string]: unknown
}

/** Registry data for Crate packages */
export interface CrateRegistryData {
  created_at?: string
  license?: string
  [key: string]: unknown
}

/** Registry data for Gem packages */
export interface GemRegistryData {
  license?: string
  licenses?: string[]
  [key: string]: unknown
}

/** Registry data for Pod packages */
export interface PodRegistryData {
  homepage?: string
  license?: string | { type: string }
  source?: { http?: string; git?: string }
  [key: string]: unknown
}

/** Registry data for PyPI packages */
export interface PyPiRegistryData {
  releases?: Record<string, { filename?: string; url?: string }[]>
  [key: string]: unknown
}

/** Registry data for Go packages */
export interface GoRegistryData {
  licenses?: string[]
  [key: string]: unknown
}

/** Maven license information */
export interface MavenLicenseInfo {
  name?: string
  url?: string
  license?: MavenLicenseInfo | MavenLicenseInfo[]
  [key: string]: unknown
}

/** Maven manifest summary */
export interface MavenManifestSummary {
  licenses?: MavenLicenseInfo[]
  project?: { licenses?: MavenLicenseInfo[] }
  [key: string]: unknown
}

/** NuGet package manifest */
export interface NuGetManifest {
  licenseExpression?: string
  licenseUrl?: string
  packageEntries?: { fullName: string }[]
  [key: string]: unknown
}

/** Harvested data structure for ClearlyDefined tool */
export interface ClearlyDefinedHarvestedData {
  facets?: Record<string, string[]>
  sourceInfo?: SourceLocationSpec
  summaryInfo?: {
    hashes?: Record<string, string>
    count?: number
  }
  files?: { path: string; hashes?: Record<string, string> }[]
  attachments?: { path: string; token?: string }[]
  interestingFiles?: { path: string; license?: string; natures?: string[] }[]
  releaseDate?: string
  registryData?:
    | NpmRegistryData
    | ComposerRegistryData
    | CrateRegistryData
    | GemRegistryData
    | PodRegistryData
    | PyPiRegistryData
    | GoRegistryData
    | DebianRegistryEntry[]
  manifest?: NuGetManifest | { summary?: MavenManifestSummary; homepage?: string; licenseExpression?: string }
  declaredLicenses?: string | string[]
  [key: string]: unknown
}

/** URL information for download and registry */
export interface ComponentUrls {
  download: string
  registry: string
  version?: string
}

/** Result of summarization (partial Definition) */
export interface SummaryResult {
  described?: {
    releaseDate?: string
    projectWebsite?: string
    issueTracker?: string
    hashes?: Record<string, string>
    files?: number
    facets?: Record<string, string[]>
    sourceLocation?: SourceLocationSpec
    urls?: {
      registry?: string
      version?: string
      download?: string
    }
  }
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

const mavenBasedUrls: Record<string, string> = {
  mavencentral: 'https://repo1.maven.org/maven2',
  gradleplugin: 'https://plugins.gradle.org/m2'
}

const condaChannels: Record<string, string> = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

/**
 * ClearlyDefined summarizer class that processes harvested data from the ClearlyDefined tool.
 * Handles summarization for multiple package types including npm, maven, nuget, gem, etc.
 */
export class ClearlyDescribedSummarizer {
  declare options: SummarizerOptions

  constructor(options: SummarizerOptions) {
    this.options = options
  }

  summarize(coordinates: EntityCoordinates, data: ClearlyDefinedHarvestedData): SummaryResult {
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

  addSummaryInfo(result: SummaryResult, data: ClearlyDefinedHarvestedData) {
    setIfValue(result, 'described.hashes', get(data, 'summaryInfo.hashes'))
    setIfValue(result, 'described.files', get(data, 'summaryInfo.count'))
  }

  addFacetInfo(result: SummaryResult, data: ClearlyDefinedHarvestedData) {
    setIfValue(result, 'described.facets', data.facets)
  }

  addSourceLocation(result: SummaryResult, data: ClearlyDefinedHarvestedData) {
    if (!data.sourceInfo) {
      return
    }
    const spec = data.sourceInfo
    updateSourceLocation(spec)
    spec.url = buildSourceUrl(spec) ?? undefined
    set(result, 'described.sourceLocation', spec)
  }

  addFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData) {
    if (!data.files) {
      return
    }
    result.files = data.files.map(file => {
      return { path: file.path, hashes: file.hashes }
    })
  }

  addAttachedFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    if (!data.attachments || !result.files) {
      return
    }
    for (const file of data.attachments) {
      const existing = result.files.find(entry => entry.path === file.path)
      if (!existing) {
        continue
      }
      existing.token = file.token
      if (isLicenseFile(file.path, coordinates)) {
        existing.natures = uniq((existing.natures || []).concat(['license']))
      }
    }
  }

  addInterestingFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    if (!data.interestingFiles) {
      return
    }
    const newDefinition = cloneDeep(result)
    const newFiles = cloneDeep(data.interestingFiles)
    for (const file of newFiles as { license?: string; path: string; natures?: string[] }[]) {
      file.license = file.license ? (SPDX.normalize(file.license) ?? undefined) : undefined
      if (!file.license) {
        delete file.license
      } else if (isLicenseFile(file.path, coordinates)) {
        file.natures = uniq((file.natures || []).concat(['license']))
      }
    }
    set(newDefinition, 'files', newFiles)
    mergeDefinitions(result, newDefinition)
  }

  addLicenseFromFiles(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    if (!data.interestingFiles) {
      return
    }
    const licenses = data.interestingFiles
      .map((file: { license?: string; path: string }) =>
        isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null
      )
      .filter((x: unknown) => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }

  getMavenUrls(coordinates: EntityCoordinates): ComponentUrls {
    const urls = { download: '', registry: '' }
    const namespaceAsFolders = coordinates.namespace ? coordinates.namespace.replace(/\./g, '/') : coordinates.namespace

    switch (coordinates.provider) {
      //For Google's Maven Repo, the artifacts do not always have the same format and sometimes are missing. We are simply providing link for the package info and let the user
      //decide on what to download
      case 'mavengoogle':
        urls.registry = `https://maven.google.com/web/index.html#${coordinates.namespace}:${coordinates.name}:${coordinates.revision}`
        urls.download = `https://maven.google.com/web/index.html#${coordinates.namespace}:${coordinates.name}:${coordinates.revision}`
        break

      default:
        urls.registry = `${mavenBasedUrls[coordinates.provider!]}/${namespaceAsFolders}/${coordinates.name}`
        urls.download = `${mavenBasedUrls[coordinates.provider!]}/${namespaceAsFolders}/${coordinates.name}/${coordinates.revision}/${coordinates.name}-${coordinates.revision}.jar`
    }

    return urls
  }

  getDeclaredLicenseMaven(data: ClearlyDefinedHarvestedData): string[] | undefined {
    const projectSummaryLicenses = (get(data, 'manifest.summary.licenses') ||
      get(data, 'manifest.summary.project.licenses')) as MavenLicenseInfo[] | undefined
    if (!projectSummaryLicenses) {
      return undefined
    }
    const licenseSummaries = flatten(projectSummaryLicenses.map((x: MavenLicenseInfo) => x.license)).filter(
      (x: unknown) => x
    ) as MavenLicenseInfo[]
    const licenseUrls = uniq([
      ...flatten(licenseSummaries.map((license: MavenLicenseInfo) => license.url)),
      ...flatten(projectSummaryLicenses.map((x: MavenLicenseInfo) => x.url))
    ]).filter((x: unknown) => x)
    const licenseNames = uniq(flatten(licenseSummaries.map((license: MavenLicenseInfo) => license.name)))
    let licenses = licenseUrls.map(url => extractLicenseFromLicenseUrl(url!)).filter((x): x is string => !!x)
    if (!licenses.length) {
      licenses = licenseNames.map(x => SPDX.lookupByName(x!) || x!).filter((x): x is string => !!x)
    }
    return licenses
  }

  addMavenData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    const urls = this.getMavenUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(result, 'described.urls.download', urls.download)
    const licenses = this.getDeclaredLicenseMaven(data)
    if (licenses?.length) {
      setIfValue(result, 'licensed.declared', SPDX.normalize(licenses.join(' OR ')))
    }
  }

  addCondaData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(get(data, 'releaseDate')))
    setIfValue(result, 'described.urls.download', get(data, 'registryData.downloadUrl'))
    setIfValue(result, 'described.urls.registry', new URL(`${condaChannels[coordinates.provider!]}`).href)
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.channelData.home'))
    const condaLicense = Array.isArray(data.declaredLicenses)
      ? data.declaredLicenses.join(' AND ')
      : data.declaredLicenses
    if (condaLicense) setIfValue(result, 'licensed.declared', SPDX.normalize(condaLicense))
  }

  addCondaSrcData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.download', get(data, 'registryData.channelData.source_url'))
    setIfValue(result, 'described.urls.registry', new URL(`${condaChannels[coordinates.provider!]}`).href)
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.channelData.home'))
    const condaSrcLicense = Array.isArray(data.declaredLicenses)
      ? data.declaredLicenses.join(' AND ')
      : data.declaredLicenses
    if (condaSrcLicense) setIfValue(result, 'licensed.declared', SPDX.normalize(condaSrcLicense))
  }

  addCrateData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(get(data, 'registryData.created_at') as string | undefined))
    setIfValue(result, 'described.projectWebsite', get(data, 'manifest.homepage'))
    const license = get(data, 'registryData.license') as string | undefined
    if (license) {
      setIfValue(result, 'licensed.declared', SPDX.normalize(license.split('/').join(' OR ')))
    }
    setIfValue(result, 'described.urls.registry', `https://crates.io/crates/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://crates.io/api/v1/crates/${coordinates.name}/${coordinates.revision}/download`
    )
  }

  addSourceArchiveData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
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
    if (licenses?.length) {
      setIfValue(result, 'licensed.declared', SPDX.normalize(licenses.join(' OR ')))
    }
  }

  addNuGetData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const licenseExpression = get(data, 'manifest.licenseExpression') as string | undefined
    const normalizedLicenseExpression = licenseExpression ? SPDX.normalize(licenseExpression) : null
    const licenseUrl = get(data, 'manifest.licenseUrl') as string | undefined
    if (normalizedLicenseExpression) {
      set(result, 'licensed.declared', normalizedLicenseExpression)
    } else if (licenseUrl?.trim()) {
      set(result, 'licensed.declared', extractLicenseFromLicenseUrl(licenseUrl) || 'NOASSERTION')
    }
    setIfValue(result, 'described.urls.registry', `https://nuget.org/packages/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://nuget.org/api/v2/package/${coordinates.name}/${coordinates.revision}`
    )
    const packageEntries = get(data, 'manifest.packageEntries') as { fullName: string }[] | undefined
    if (!packageEntries) {
      return
    }
    const newDefinition = cloneDeep(result)
    newDefinition.files = packageEntries.map((file: { fullName: string }) => {
      return { path: file.fullName }
    })
    mergeDefinitions(result, newDefinition, get(result, 'licensed.declared') === 'OTHER')
  }

  parseLicenseExpression(manifest: NpmManifest | ComposerManifest, packageType: string): string | null {
    const combineLicenses = (exp: string | null, license: unknown): string | null => {
      if (exp) {
        return `${exp} ${packageType === 'npm' ? 'AND' : 'OR'} ${stringObjectArray(license)}`
      }
      return stringObjectArray(license)
    }
    const stringObjectArray = (value: unknown): string | null => {
      if (!value) {
        return null
      }
      if (typeof value === 'string') {
        return value
      }
      if (Array.isArray(value)) {
        return value.reduce(combineLicenses, null) as string | null
      }
      if (typeof (value as { type?: unknown }).type === 'string') {
        return (value as { type: string }).type
      }
      if (Array.isArray((value as { type?: unknown }).type)) {
        return (value as { type: unknown[] }).type.reduce(combineLicenses, null) as string | null
      }
      return null
    }
    return (
      stringObjectArray(manifest.license) ||
      (packageType === 'npm' ? stringObjectArray((manifest as NpmManifest).licenses) : null)
    )
  }

  addNpmData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    if (!data.registryData) {
      return
    }
    const registryData = data.registryData as NpmRegistryData
    setIfValue(result, 'described.releaseDate', extractDate(registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://npmjs.com/package/${
        coordinates.namespace ? `${coordinates.namespace}/${coordinates.name}` : coordinates.name
      }`
    )
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/v/${coordinates.revision}`)
    setIfValue(
      result,
      'described.urls.download',
      `https://registry.npmjs.com/${
        coordinates.namespace ? `${coordinates.namespace}/${coordinates.name}` : coordinates.name
      }/-/${coordinates.name}-${coordinates.revision}.tgz`
    )
    const manifest = registryData.manifest
    if (!manifest) {
      return
    }
    let homepage = manifest.homepage
    if (homepage && isArray(homepage)) {
      homepage = homepage[0]
    }
    setIfValue(result, 'described.projectWebsite', homepage)
    const bugs = manifest.bugs
    if (bugs) {
      if (typeof bugs === 'string') {
        if (bugs.startsWith('http')) {
          setIfValue(result, 'described.issueTracker', bugs)
        }
      } else {
        setIfValue(result, 'described.issueTracker', bugs.url || bugs.email)
      }
    }
    const expression = this.parseLicenseExpression(manifest, 'npm')
    if (!expression) {
      return
    }
    setIfValue(result, 'licensed.declared', SPDX.normalize(expression))
  }

  addComposerData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    if (!data.registryData) {
      return
    }
    const registryData = data.registryData as ComposerRegistryData
    setIfValue(result, 'described.releaseDate', extractDate(registryData.releaseDate))
    setIfValue(
      result,
      'described.urls.registry',
      `https://packagist.org/packages/${`${coordinates.namespace}/${coordinates.name}`}`
    )
    const manifest = registryData.manifest
    if (!manifest) {
      return
    }
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}#${manifest.version}`)
    setIfValue(result, 'described.projectWebsite', manifest.homepage)
    if (manifest.dist?.url) {
      setIfValue(result, 'described.urls.download', manifest.dist.url)
    }
    const expression = this.parseLicenseExpression(manifest, 'composer')
    if (!expression) {
      return
    }
    setIfValue(result, 'licensed.declared', SPDX.normalize(expression))
  }

  addPodData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.projectWebsite', get(data, 'registryData.homepage'))
    const license = get(data, 'registryData.license') as string | { type?: string } | undefined
    if (license) {
      const licenseStr = typeof license === 'string' ? license : license.type
      if (licenseStr) setIfValue(result, 'licensed.declared', SPDX.normalize(licenseStr))
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

  addGemData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    const gemLicenseRaw = get(data, 'registryData.license') as string | undefined
    const license = gemLicenseRaw ? SPDX.normalize(gemLicenseRaw) : null
    if (license) {
      set(result, 'licensed.declared', license)
    } else {
      const gemLicenses = (get(data, 'registryData.licenses') as string[] | undefined) || []
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

  addPyPiData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'licensed.declared', data['declaredLicense'])
    setIfValue(result, 'described.urls.registry', `https://pypi.org/project/${coordinates.name}`)
    setIfValue(result, 'described.urls.version', `${get(result, 'described.urls.registry')}/${coordinates.revision}`)
    // TODO: we are currently picking the first url that contains a tar.gz or zip extension
    // we should understand what's the correct process on a pypi definition that contains multiple object for the same release
    const releases = get(data, 'registryData.releases') as
      | Record<string, { filename?: string; url?: string }[]>
      | undefined
    if (releases) {
      const revision = find(releases[coordinates.revision!], revision =>
        revision.filename ? revision.filename.includes('tar.gz') || revision.filename.includes('zip') : false
      )
      if (revision) {
        setIfValue(result, 'described.urls.download', revision.url)
      }
    }
  }

  getGitUrls(coordinates: EntityCoordinates): ComponentUrls {
    const urls = { download: '', registry: '', version: '' }
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

  addGitData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    const urls = this.getGitUrls(coordinates)

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', urls.version)
    setIfValue(result, 'described.urls.download', urls.download)
  }

  addDebData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) {
      return
    }
    const registryData = data.registryData as DebianRegistryEntry[]
    const registryUrl = this.getDebianRegistryUrl(registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      if (result.described?.sourceLocation) {
        result.described.sourceLocation.url = registryUrl
      }
    }
    const architecture = coordinates.revision!.split('_')[1]
    const downloadUrl = new URL(
      `http://ftp.debian.org/debian/${registryData.find((entry: DebianRegistryEntry) => entry.Architecture === architecture)!.Path}`
    ).href
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  addDebSrcData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    if (!data.registryData) {
      return
    }
    const registryData = data.registryData as DebianRegistryEntry[]
    const registryUrl = this.getDebianRegistryUrl(registryData)
    if (registryUrl) {
      set(result, 'described.urls.registry', registryUrl)
      set(result, 'described.urls.version', registryUrl)
      result.described!.sourceLocation = { ...coordinates, url: registryUrl }
    }
    const downloadUrl = new URL(
      `http://ftp.debian.org/debian/${registryData.find((entry: DebianRegistryEntry) => entry.Path.includes('.orig.tar.'))!.Path}`
    ).href
    // There is also patches URL which is related to sources but it's not part of the schema
    setIfValue(result, 'described.urls.download', downloadUrl)
    const license = uniq(data.declaredLicenses || []).join(' AND ')
    setIfValue(result, 'licensed.declared', SPDX.normalize(license))
  }

  getDebianRegistryUrl(registryData: DebianRegistryEntry[]): string | null {
    const registryPath = registryData[0].Path
    if (registryPath) {
      // Example: ./pool/main/0/0ad/0ad_0.0.17-1.debian.tar.xz -> http://ftp.debian.org/debian/pool/main/0/0ad
      const pathName = registryPath.split('/').slice(1, 5).join('/')
      return `http://ftp.debian.org/debian/${pathName}`
    }
    return null
  }

  addGoData(result: SummaryResult, data: ClearlyDefinedHarvestedData, coordinates: EntityCoordinates) {
    const urls = { download: '', registry: '', version: '' }

    const namespaceAsFolders = coordinates.namespace ? deCodeSlashes(coordinates.namespace) : coordinates.namespace

    urls.registry = `https://pkg.go.dev/${namespaceAsFolders}/${coordinates.name}`
    urls.download = `https://proxy.golang.org/${namespaceAsFolders}/${coordinates.name}/@v/${coordinates.revision}.zip`
    urls.version = `https://pkg.go.dev/${namespaceAsFolders}/${coordinates.name}@${coordinates.revision}`

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))

    setIfValue(result, 'described.releaseDate', extractDate(data.releaseDate))
    setIfValue(result, 'described.urls.registry', urls.registry)
    setIfValue(result, 'described.urls.version', urls.version)
    setIfValue(result, 'described.urls.download', urls.download)
    const licenses = (get(data, 'registryData.licenses') as string[]) || []
    // Based on the https://pkg.go.dev/license-policy and github.com/google/licensecheck,
    // ',' means use AND logic.
    const andClause = ' AND '
    const declaredLicense = licenses.map((license: string) => license.replace(/, /g, andClause)).join(andClause)
    setIfValue(result, 'licensed.declared', SPDX.normalize(declaredLicense))
  }
}

export default (options?: SummarizerOptions) => new ClearlyDescribedSummarizer(options!)
