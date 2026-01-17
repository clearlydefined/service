// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { FileEntry } from '../../lib/utils'
import type { SummarizerOptions } from './index'

/** Licensee matched file information */
export interface LicenseeMatchedFile {
  filename: string
  matched_license?: string
  matcher?: {
    name?: string
    confidence?: number | string
  }
  [key: string]: unknown
}

/** Licensee output content */
export interface LicenseeOutputContent {
  matched_files?: LicenseeMatchedFile[]
  [key: string]: unknown
}

/** Licensee output wrapper */
export interface LicenseeOutput {
  content?: LicenseeOutputContent
  [key: string]: unknown
}

/** Licensee tool information */
export interface LicenseeTool {
  version?: string
  output?: LicenseeOutput
  [key: string]: unknown
}

/** Attachment information */
export interface LicenseeAttachment {
  path: string
  token?: string
  [key: string]: unknown
}

/** Harvested data structure for Licensee tool */
export interface LicenseeHarvestedData {
  licensee?: LicenseeTool
  attachments?: LicenseeAttachment[]
  [key: string]: unknown
}

/** Result of Licensee summarization (partial Definition) */
export interface LicenseeSummaryResult {
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * Licensee summarizer class that processes harvested data from the Licensee tool.
 * Extracts license information from matched license files.
 */
export declare class LicenseeSummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /**
   * Creates a new LicenseeSummarizer instance
   *
   * @param options - Configuration options for the summarizer
   */
  constructor(options: SummarizerOptions)

  /**
   * Summarize the raw information related to the given coordinates.
   *
   * @param coordinates - The entity for which we are summarizing
   * @param harvested - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   * @throws Error if Licensee data is invalid
   */
  summarize(coordinates: EntityCoordinates, harvested: LicenseeHarvestedData): LicenseeSummaryResult

  /**
   * Summarizes matched files into FileEntry format
   *
   * @param harvested - The harvested data
   * @returns Array of file entries or null
   */
  _summarizeFiles(harvested: LicenseeHarvestedData): FileEntry[] | null

  /**
   * Adds declared license from license files to the result
   *
   * @param result - The result object to modify
   * @param coordinates - The entity coordinates
   */
  _addLicenseFromFiles(result: LicenseeSummaryResult, coordinates: EntityCoordinates): void
}

/**
 * Factory function that creates a LicenseeSummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @returns A new LicenseeSummarizer instance
 */
declare function licenseeSummarizerFactory(options?: SummarizerOptions): LicenseeSummarizer

export = licenseeSummarizerFactory
