// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type EntityCoordinates from '../../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../../lib/utils.ts'
import type { Logger } from '../../logging/index.js'
import type { SummarizerOptions } from '../index.ts'
import type {
  ScanCodeCopyright,
  ScanCodeFile,
  ScanCodeHarvestedData,
  ScanCodeLicenseDetection,
  ScanCodePackage,
  ScanCodeSummaryResult
} from '../scancode.ts'

const { get, flatten, uniq } = lodash

import SPDX from '@clearlydefined/spdx'
import {
  extractDate,
  getLicenseLocations,
  isDeclaredLicense,
  isLicenseFile,
  joinExpressions,
  normalizeLicenseExpression,
  setIfValue
} from '../../../lib/utils.ts'

/**
 * ScanCode New summarizer class that processes harvested data from newer
 * versions of ScanCode (32.1.0 and above).
 */
export class ScanCodeNewSummarizer {
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
    harvestedData: ScanCodeHarvestedData
  ): ScanCodeSummaryResult {
    if (!scancodeVersion) {
      throw new Error('Not valid ScanCode data')
    }

    const result: ScanCodeSummaryResult = {}
    this.addDescribedInfo(result, harvestedData)

    let declaredLicense = this._getDeclaredLicense(harvestedData)
    if (!isDeclaredLicense(declaredLicense)) {
      declaredLicense = this._getDetectedLicensesFromFiles(harvestedData, coordinates) || declaredLicense
    }
    setIfValue(result, 'licensed.declared', declaredLicense)

    result.files = this._summarizeFileInfo(harvestedData.content.files, coordinates)

    return result
  }

  addDescribedInfo(result: ScanCodeSummaryResult, harvestedData: ScanCodeHarvestedData) {
    const releaseDate = harvestedData._metadata.releaseDate
    if (releaseDate) {
      result.described = { releaseDate: extractDate(releaseDate.trim()) }
    }
  }

  _getDeclaredLicense(harvestedData: ScanCodeHarvestedData): string | null {
    const licenseReaders = [
      this._readDeclaredLicenseExpressionFromSummary.bind(this),
      this._readDeclaredLicenseExpressionFromPackage.bind(this),
      this._readExtractedLicenseStatementFromPackage.bind(this)
    ]

    for (const reader of licenseReaders) {
      const declaredLicense = reader(harvestedData)
      if (isDeclaredLicense(declaredLicense)) {
        return declaredLicense
      }
    }

    return null
  }

  _readDeclaredLicenseExpressionFromSummary({ content }: ScanCodeHarvestedData): string | null {
    const licenseExpression = get(content, 'summary.declared_license_expression') as string | undefined
    const result = licenseExpression && normalizeLicenseExpression(licenseExpression, this.logger)

    return result?.includes('NOASSERTION') ? null : result
  }

  _readDeclaredLicenseExpressionFromPackage({ content }: ScanCodeHarvestedData): string | null {
    const { packages } = content
    if (!packages) {
      return null
    }
    const [firstPackage] = packages
    if (!firstPackage) {
      return null
    }

    const licenseExpression = firstPackage.declared_license_expression_spdx

    return licenseExpression?.includes('NOASSERTION') ? null : licenseExpression
  }

  _readExtractedLicenseStatementFromPackage({ content }: ScanCodeHarvestedData): string | null {
    const declared_license = get(content, 'packages[0].extracted_license_statement') as string | undefined
    return SPDX.normalize(declared_license)
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
    return files.filter((file: ScanCodeFile) => {
      for (const root of roots) {
        if (file.path.startsWith(root) && file.path.slice(root.length).indexOf('/') === -1) {
          return true
        }
      }
      return false
    })
  }

  _getDetectedLicensesFromFiles(harvestedData: ScanCodeHarvestedData, coordinates: EntityCoordinates): string | null {
    const rootFiles = this._getRootFiles(coordinates, harvestedData.content.files, harvestedData.content.packages)
    return this._getFileLicensesFromDetectedLicenseExpressions(rootFiles)
  }

  _getFileLicensesFromDetectedLicenseExpressions(files: ScanCodeFile[]): string | null {
    const fullLicenses = new Set(
      files
        .filter((file: ScanCodeFile) => file.percentage_of_license_text >= 90 && file.detected_license_expression_spdx)
        .map((file: ScanCodeFile) => file.detected_license_expression_spdx as string)
    )
    return joinExpressions(fullLicenses)
  }

  _getClosestLicenseMatchByFileName(files: ScanCodeFile[], coordinates: EntityCoordinates): string | null {
    const fullLicenses = files
      .filter((file: ScanCodeFile) => isLicenseFile(file.path, coordinates) && file.license_detections)
      .reduce((licenses: Set<string>, file: ScanCodeFile) => {
        if (file.license_detections) {
          for (const licenseDetection of file.license_detections as ScanCodeLicenseDetection[]) {
            if (licenseDetection.license_expression_spdx) {
              licenses.add(licenseDetection.license_expression_spdx)
              continue
            }
            if (licenseDetection.matches) {
              for (const match of licenseDetection.matches as { score?: number; spdx_license_expression?: string }[]) {
                // Only consider matches with high clarity score of 90 or higher
                if (match.score >= 90 && match.spdx_license_expression) {
                  licenses.add(match.spdx_license_expression)
                }
              }
            }
          }
        }
        return licenses
      }, new Set<string>())
    return joinExpressions(fullLicenses)
  }

  _getLicenseExpressionFromFileLicenseDetections(file: ScanCodeFile): string | null {
    if (!file.license_detections) {
      return null
    }
    const licenseExpressions = file.license_detections.reduce(
      (licenseExpressions: Set<string>, licenseDetection: ScanCodeLicenseDetection) => {
        if (licenseDetection.license_expression_spdx) {
          licenseExpressions.add(licenseDetection.license_expression_spdx)
        } else if (licenseDetection.matches) {
          for (const match of licenseDetection.matches as { score?: number; spdx_license_expression?: string }[]) {
            // Only consider matches with a reasonably high score of 80 or higher
            if (match.score >= 80 && match.spdx_license_expression) {
              licenseExpressions.add(match.spdx_license_expression)
            }
          }
        }
        return licenseExpressions
      },
      new Set<string>()
    )
    return joinExpressions(licenseExpressions)
  }

  _summarizeFileInfo(files: ScanCodeFile[], coordinates: EntityCoordinates): FileEntry[] {
    return files
      .map((file: ScanCodeFile) => {
        if (file.type !== 'file') {
          return null
        }

        const result: FileEntry = { path: file.path }

        const licenseExpression =
          file.detected_license_expression_spdx || this._getLicenseExpressionFromFileLicenseDetections(file)
        setIfValue(result, 'license', licenseExpression)

        if (
          this._getFileLicensesFromDetectedLicenseExpressions([file]) ||
          this._getClosestLicenseMatchByFileName([file], coordinates)
        ) {
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
                flatten(file.copyrights.map((c: ScanCodeCopyright) => c.copyright || c.statements || c.value))
              ).filter((x: unknown) => x)
            : null
        )
        setIfValue(result, 'hashes.sha1', file.sha1)
        setIfValue(result, 'hashes.sha256', file.sha256)

        return result
      })
      .filter((e: FileEntry | null) => e !== null)
  }
}

export default (options?: SummarizerOptions, logger?: Logger) => new ScanCodeNewSummarizer(options, logger)
