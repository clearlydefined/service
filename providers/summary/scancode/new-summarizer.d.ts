// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../../lib/entityCoordinates'
import type { Logger } from '../../logging'
import type { FileEntry } from '../../../lib/utils'
import type { SummarizerOptions } from '../index'
import type { ScanCodeFile, ScanCodeHarvestedData, ScanCodeSummaryResult, ScanCodePackage } from '../scancode'

/**
 * ScanCode New summarizer class that processes harvested data from newer
 * versions of ScanCode (32.1.0 and above).
 */
export declare class ScanCodeNewSummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /** Logger instance */
  logger: Logger

  /**
   * Creates a new ScanCodeNewSummarizer instance
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
   * @param harvestedData - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   * @throws Error if ScanCode version is not provided
   */
  summarize(
    scancodeVersion: string,
    coordinates: EntityCoordinates,
    harvestedData: ScanCodeHarvestedData
  ): ScanCodeSummaryResult

  /**
   * Adds described info (release date) to the result
   *
   * @param result - The result object to modify
   * @param harvestedData - The harvested data
   */
  addDescribedInfo(result: ScanCodeSummaryResult, harvestedData: ScanCodeHarvestedData): void

  /**
   * Gets the declared license from multiple sources in order of priority
   *
   * @param harvestedData - The harvested data
   * @returns Declared license expression or null
   */
  _getDeclaredLicense(harvestedData: ScanCodeHarvestedData): string | null

  /**
   * Reads declared license expression from summary section
   *
   * @param harvestedData - The harvested data (destructured to content)
   * @returns License expression or null
   */
  _readDeclaredLicenseExpressionFromSummary(harvestedData: ScanCodeHarvestedData): string | null

  /**
   * Reads declared license expression from package information
   *
   * @param harvestedData - The harvested data (destructured to content)
   * @returns License expression or null
   */
  _readDeclaredLicenseExpressionFromPackage(harvestedData: ScanCodeHarvestedData): string | null

  /**
   * Reads extracted license statement from package information
   *
   * @param harvestedData - The harvested data (destructured to content)
   * @returns Normalized license expression or null
   */
  _readExtractedLicenseStatementFromPackage(harvestedData: ScanCodeHarvestedData): string | null

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
   * Gets detected licenses from files when no declared license is found
   *
   * @param harvestedData - The harvested data
   * @param coordinates - The entity coordinates
   * @returns License expression or null
   */
  _getDetectedLicensesFromFiles(harvestedData: ScanCodeHarvestedData, coordinates: EntityCoordinates): string | null

  /**
   * Gets license expressions from files based on detected_license_expression_spdx
   *
   * @param files - Files to analyze
   * @returns License expression or null
   */
  _getFileLicensesFromDetectedLicenseExpressions(files: ScanCodeFile[]): string | null

  /**
   * Gets the closest license match by analyzing license file names
   *
   * @param files - Files to analyze
   * @param coordinates - The entity coordinates
   * @returns License expression or null
   */
  _getClosestLicenseMatchByFileName(files: ScanCodeFile[], coordinates: EntityCoordinates): string | null

  /**
   * Gets license expression from file's license detections
   *
   * @param file - The file to analyze
   * @returns License expression or null
   */
  _getLicenseExpressionFromFileLicenseDetections(file: ScanCodeFile): string | null

  /**
   * Summarizes file information into FileEntry format
   *
   * @param files - ScanCode file entries to summarize
   * @param coordinates - The entity coordinates
   * @returns Array of summarized file entries
   */
  _summarizeFileInfo(files: ScanCodeFile[], coordinates: EntityCoordinates): FileEntry[]
}

/**
 * Factory function that creates a ScanCodeNewSummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @param logger - Logger instance for logging
 * @returns A new ScanCodeNewSummarizer instance
 */
declare function newSummarizerFactory(options: SummarizerOptions, logger: Logger): ScanCodeNewSummarizer

export = newSummarizerFactory
