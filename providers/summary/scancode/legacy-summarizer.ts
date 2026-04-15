// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type EntityCoordinates from '../../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../../lib/utils.ts'
import type { Logger } from '../../logging/index.js'
import type { SummarizerOptions } from '../index.ts'
import type {
  ScanCodeFile,
  ScanCodeHarvestedData,
  ScanCodeLicense,
  ScanCodePackage,
  ScanCodeSummaryResult
} from '../scancode.ts'

const { get, flatten, uniq } = lodash

import SPDX from '@clearlydefined/spdx'
import {
  addArrayToSet,
  extractDate,
  getLicenseLocations,
  isDeclaredLicense,
  isLicenseFile,
  joinExpressions,
  normalizeLicenseExpression,
  setIfValue
} from '../../../lib/utils.ts'

/**
 * ScanCode Legacy summarizer class that processes harvested data from older
 * versions of ScanCode (2.2.1 through 30.1.0).
 */
export class ScanCodeLegacySummarizer {
  declare options: SummarizerOptions
  declare logger: Logger

  constructor(
    options: SummarizerOptions = {} as SummarizerOptions,
    logger: Logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, log: () => {} }
  ) {
    this.options = options
    this.logger = logger
  }

  summarize(
    scancodeVersion: string,
    coordinates: EntityCoordinates,
    harvested: ScanCodeHarvestedData
  ): ScanCodeSummaryResult {
    const result: ScanCodeSummaryResult = {}
    this.addDescribedInfo(result, harvested)
    let declaredLicense = this._getDeclaredLicenseFromSummary(scancodeVersion, harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDeclaredLicenseFromFiles(scancodeVersion, harvested, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)
    result.files = this._summarizeFileInfo(harvested.content.files, coordinates)
    return result
  }

  addDescribedInfo(result: ScanCodeSummaryResult, harvested: ScanCodeHarvestedData) {
    const releaseDate = harvested._metadata.releaseDate
    if (releaseDate) {
      result.described = { releaseDate: extractDate(releaseDate.trim())! }
    }
  }

  _getDeclaredLicenseFromSummary(scancodeVersion: string, harvested: ScanCodeHarvestedData): string | null {
    let declaredLicense = this._readDeclaredLicenseFromSummary(scancodeVersion, harvested)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._readLicenseExpressionFromSummary(harvested) || declaredLicense
    }
    return declaredLicense
  }

  _readDeclaredLicenseFromSummary(scancodeVersion: string, harvested: ScanCodeHarvestedData): string | null {
    switch (scancodeVersion) {
      case '2.2.1':
      case '2.9.1':
      case '2.9.2':
      case '2.9.8':
      case '3.0.0':
      case '3.0.2':
        const declLicense = get(harvested, 'content.summary.packages[0].declared_license') as string | undefined
        return declLicense ? SPDX.normalize(declLicense) ?? null : null
      case '30.1.0': {
        const rawDeclaredLicense = get(harvested, 'content.summary.packages[0].declared_license') as
          | string
          | { name?: string; license?: string }
          | string[]
          | undefined
        let declared_license: string | { name?: string; license?: string } | undefined = Array.isArray(
          rawDeclaredLicense
        )
          ? rawDeclaredLicense[0]
          : rawDeclaredLicense
        // Some Maven packages have this value as an object rather than a string
        // Example: for maven/mavencentral/redis.clients/jedis/4.1.1
        // declared_license would be { "name": "MIT", "url": "http://github.com/redis/jedis/raw/master/LICENSE.txt", "comments": null, "distribution": "repo" }'
        // Some pypi packages have this value as an object with a license field
        // Example: for pypi/pypi/abseil/absl-py/0.9.0
        // declared_license would be { "license": "Apache 2.0", "classifiers": ["License :: OSI Approved :: Apache Software License"] }
        // biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality to catch both null and undefined
        if (typeof declared_license != 'string' && declared_license != undefined) {
          declared_license = declared_license.name || declared_license.license
        }

        const finalLicense = declared_license as string | undefined
        return finalLicense ? SPDX.normalize(finalLicense) ?? null : null
      }
      default:
        throw new Error(`Invalid version of ScanCode: ${scancodeVersion}`)
    }
  }

  _readLicenseExpressionFromSummary(harvested: ScanCodeHarvestedData): string | null {
    const licenseExpression = get(harvested, 'content.summary.packages[0].license_expression') as string | undefined
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression, this.logger, null)
    return result?.includes('NOASSERTION') ? null : result ?? null
  }

  _getRootFiles(coordinates: EntityCoordinates, files: ScanCodeFile[], packages?: ScanCodePackage[]): ScanCodeFile[] {
    const roots = getLicenseLocations(coordinates, packages) || []
    roots.push('') // for no prefix
    let rootFiles = this._findRootFiles(files, roots)
    //Some components (e.g. composer/packgist) are packaged under one directory
    if (rootFiles.length === 1 && rootFiles[0].type === 'directory') {
      rootFiles = this._findRootFiles(files, [`${rootFiles[0].path}/`])
    }
    return rootFiles
  }

  _findRootFiles(files: ScanCodeFile[], roots: string[]): ScanCodeFile[] {
    return files.filter(file => {
      for (const root of roots) {
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) {
          return true
        }
      }
      return false
    })
  }

  _getDeclaredLicenseFromFiles(
    scancodeVersion: string,
    harvested: ScanCodeHarvestedData,
    coordinates: EntityCoordinates
  ): string | null {
    const rootFile = this._getRootFiles(coordinates, harvested.content.files, harvested.content.packages)
    switch (scancodeVersion) {
      case '2.2.1':
        return this._getLicenseByPackageAssertion(rootFile)
      case '2.9.2':
      case '2.9.8':
        return this._getLicenseByFileName(rootFile, coordinates)
      case '3.0.0':
      case '3.0.2':
        return this._getLicenseByIsLicenseText(rootFile)
      case '30.1.0':
        return this._getLicenseByIsLicenseText(rootFile)
      default:
        return null
    }
  }

  _getLicenseByIsLicenseText(files: ScanCodeFile[]): string | null {
    const fullLicenses = files
      .filter(file => file.is_license_text && file.licenses)
      .reduce((licenses, file) => {
        if (file.licenses) {
          for (const license of file.licenses) {
            const expr = this._createExpressionFromLicense(license)
            if (expr) {
              licenses.add(expr)
            }
          }
        }
        return licenses
      }, new Set<string>())
    return joinExpressions(fullLicenses)
  }

  _getLicenseByFileName(files: ScanCodeFile[], coordinates: EntityCoordinates): string | null {
    const fullLicenses = files
      .filter(file => isLicenseFile(file.path, coordinates) && file.licenses)
      .reduce((licenses, file) => {
        if (file.licenses) {
          for (const license of file.licenses) {
            if (license.score && license.score >= 90) {
              const expr = this._createExpressionFromLicense(license)
              if (expr) {
                licenses.add(expr)
              }
            }
          }
        }
        return licenses
      }, new Set<string>())
    return joinExpressions(fullLicenses)
  }

  _getLicenseByPackageAssertion(files: ScanCodeFile[]): string | null {
    for (const file of files) {
      const asserted = get(file, 'packages[0].asserted_licenses') as
        | { license?: string; spdx_license_key?: string }[]
        | undefined
      // Find the first package file and treat it as the authority
      if (asserted) {
        const packageLicenses = addArrayToSet(
          asserted,
          new Set<string>(),
          // TODO, is `license.license` real?
          license => (license.license || license.spdx_license_key)!
        )
        return joinExpressions(packageLicenses)
      }
    }
    return null
  }

  _summarizeFileInfo(files: ScanCodeFile[], coordinates: EntityCoordinates): FileEntry[] {
    return files
      .map(file => {
        if (file.type !== 'file') {
          return null
        }
        const result: FileEntry = { path: file.path }
        const asserted = get(file, 'packages[0].asserted_licenses') as ScanCodeLicense[] | undefined
        const fileLicense = asserted || file.licenses || []
        let licenses = new Set(
          fileLicense.map((x: ScanCodeLicense) => x.license).filter((x): x is string => typeof x === 'string')
        )
        if (!licenses.size) {
          licenses = new Set(
            fileLicense
              .filter((x: ScanCodeLicense) => x.score !== undefined && x.score >= 80)
              .map((x: ScanCodeLicense) => this._createExpressionFromLicense(x))
              .filter((x): x is string => x !== null)
          )
        }
        const licenseExpression = joinExpressions(licenses)
        setIfValue(result, 'license', licenseExpression)
        if (this._getLicenseByIsLicenseText([file]) || this._getLicenseByFileName([file], coordinates)) {
          result.natures = result.natures || []
          if (!result.natures.includes('license')) {
            result.natures.push('license')
          }
        }
        setIfValue(
          result,
          'attributions',
          file.copyrights
            ? uniq(
                flatten(file.copyrights.map((c: import('../scancode.ts').ScanCodeCopyright) => c.statements || c.value))
              ).filter((x: unknown) => x)
            : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
        return result
      })
      .filter((e: FileEntry | null) => e !== null)
  }

  _createExpressionFromLicense(license: ScanCodeLicense): string | null {
    const rule = license.matched_rule
    if (!rule?.license_expression) {
      return license.spdx_license_key ? SPDX.normalize(license.spdx_license_key) ?? null : null
    }
    return normalizeLicenseExpression(rule.license_expression, this.logger, null)
  }
}

export default (options?: SummarizerOptions, logger?: Logger) => new ScanCodeLegacySummarizer(options, logger)
