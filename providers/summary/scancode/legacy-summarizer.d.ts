// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../../lib/entityCoordinates'
import type { Logger } from '../../logging'
import type { FileEntry } from '../../../lib/utils'
import type { SummarizerOptions } from '../index'
import type {
  ScanCodeFile,
  ScanCodeHarvestedData,
  ScanCodeSummaryResult,
  ScanCodeLicense,
  ScanCodePackage
} from '../scancode'

/**
 * ScanCode Legacy summarizer class that processes harvested data from older
 * versions of ScanCode (2.2.1 through 30.1.0).
 */
export declare class ScanCodeLegacySummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /** Logger instance */
  logger: Logger

  /**
   * Creates a new ScanCodeLegacySummarizer instance
   *
   * @param options - Configuration options for the summarizer
   * @param logger - Logger instance for logging
   */
  constructor(options: SummarizerOptions, logger: Logger)

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param scancodeVersion - The version of ScanCode used to generate the harvested data
   * @param coordinates - The entity for which we are summarizing
   * @param harvested - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   */
  summarize(
    scancodeVersion: string,
    coordinates: EntityCoordinates,
    harvested: ScanCodeHarvestedData
  ): ScanCodeSummaryResult

  /**
   * Adds described info (release date) to the result
   *
   * @param result - The result object to modify
   * @param harvested - The harvested data
   */
  addDescribedInfo(result: ScanCodeSummaryResult, harvested: ScanCodeHarvestedData): void

  /**
   * Gets the root files that should be considered for license determination
   *
   * @param coordinates - The entity coordinates
   * @param files - All files from the scan
   * @param packages - Package information from the scan
   * @returns Array of root files
   */
  _getRootFiles(coordinates: EntityCoordinates, files: ScanCodeFile[], packages?: ScanCodePackage[]): ScanCodeFile[]

  /**
   * Finds files at the root level given a set of root prefixes
   *
   * @param files - All files to filter
   * @param roots - Root path prefixes to match
   * @returns Filtered array of root files
   */
  _findRootFiles(files: ScanCodeFile[], roots: string[]): ScanCodeFile[]

  /**
   * Gets declared license from the summary section
   *
   * @param scancodeVersion - The ScanCode version
   * @param harvested - The harvested data
   * @returns Declared license expression or null
   */
  _getDeclaredLicenseFromSummary(scancodeVersion: string, harvested: ScanCodeHarvestedData): string | null

  /**
   * Gets declared license by analyzing root files
   *
   * @param scancodeVersion - The ScanCode version
   * @param harvested - The harvested data
   * @param coordinates - The entity coordinates
   * @returns Declared license expression or null
   */
  _getDeclaredLicenseFromFiles(
    scancodeVersion: string,
    harvested: ScanCodeHarvestedData,
    coordinates: EntityCoordinates
  ): string | null

  /**
   * Gets license from files marked as license text
   *
   * @param files - Files to analyze
   * @returns License expression or null
   */
  _getLicenseByIsLicenseText(files: ScanCodeFile[]): string | null

  /**
   * Gets license from files matching license file naming patterns
   *
   * @param files - Files to analyze
   * @param coordinates - The entity coordinates
   * @returns License expression or null
   */
  _getLicenseByFileName(files: ScanCodeFile[], coordinates: EntityCoordinates): string | null

  /**
   * Gets license from package assertion information
   *
   * @param files - Files containing package information
   * @returns License expression or null
   */
  _getLicenseByPackageAssertion(files: ScanCodeFile[]): string | null

  /**
   * Summarizes file information into FileEntry format
   *
   * @param files - ScanCode file entries to summarize
   * @param coordinates - The entity coordinates
   * @returns Array of summarized file entries
   */
  _summarizeFileInfo(files: ScanCodeFile[], coordinates: EntityCoordinates): FileEntry[]

  /**
   * Creates a normalized license expression from a license object
   *
   * @param license - The license object from ScanCode
   * @returns Normalized SPDX license expression or null
   */
  _createExpressionFromLicense(license: ScanCodeLicense): string | null
}

/**
 * Factory function that creates a ScanCodeLegacySummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @param logger - Logger instance for logging
 * @returns A new ScanCodeLegacySummarizer instance
 */
declare function legacySummarizerFactory(options: SummarizerOptions, logger: Logger): ScanCodeLegacySummarizer

export = legacySummarizerFactory
