// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { Logger } from '../logging'
import type { FileEntry } from '../../lib/utils'
import type { SummarizerOptions } from './index'

/** ScanCode file license information */
export interface ScanCodeLicense {
  license?: string
  spdx_license_key?: string
  score?: number
  matched_rule?: {
    license_expression?: string
    [key: string]: unknown
  }
  license_expression_spdx?: string
  [key: string]: unknown
}

/** ScanCode license detection information (new format) */
export interface ScanCodeLicenseDetection {
  license_expression_spdx?: string
  matches?: {
    score?: number
    spdx_license_expression?: string
    [key: string]: unknown
  }[]
  [key: string]: unknown
}

/** ScanCode copyright information */
export interface ScanCodeCopyright {
  statements?: string[]
  value?: string
  copyright?: string
  [key: string]: unknown
}

/** ScanCode package information */
export interface ScanCodePackage {
  name?: string
  type?: string
  version?: string
  asserted_licenses?: { license?: string; spdx_license_key?: string }[]
  declared_license?: string | { name?: string; license?: string } | string[]
  declared_license_expression_spdx?: string
  extracted_license_statement?: string
  [key: string]: unknown
}

/** ScanCode file entry from scan results */
export interface ScanCodeFile {
  path: string
  type: 'file' | 'directory'
  sha1?: string
  sha256?: string
  licenses?: ScanCodeLicense[]
  license_detections?: ScanCodeLicenseDetection[]
  copyrights?: ScanCodeCopyright[]
  packages?: ScanCodePackage[]
  is_license_text?: boolean
  percentage_of_license_text?: number
  detected_license_expression_spdx?: string
  [key: string]: unknown
}

/** ScanCode summary section */
export interface ScanCodeSummary {
  packages?: ScanCodePackage[]
  declared_license_expression?: string
  [key: string]: unknown
}

/** ScanCode header information */
export interface ScanCodeHeader {
  tool_version?: string
  [key: string]: unknown
}

/** ScanCode content structure */
export interface ScanCodeContent {
  files: ScanCodeFile[]
  packages?: ScanCodePackage[]
  summary?: ScanCodeSummary
  headers?: ScanCodeHeader[]
  scancode_version?: string
  [key: string]: unknown
}

/** Harvested data structure for ScanCode tool */
export interface ScanCodeHarvestedData {
  content: ScanCodeContent
  _metadata: {
    releaseDate?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Result of ScanCode summarization (partial Definition) */
export interface ScanCodeSummaryResult {
  described?: {
    releaseDate?: string
  }
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * ScanCode delegator class that routes summarization to the appropriate
 * version-specific summarizer based on the ScanCode version.
 */
export declare class ScanCodeSummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /** Logger instance */
  logger: Logger

  /**
   * Creates a new ScanCodeDelegator instance
   *
   * @param options - Configuration options for the summarizer
   * @param logger - Logger instance for logging
   */
  constructor(options: SummarizerOptions, logger?: Logger)

  /**
   * Summarize the raw information related to the given coordinates.
   * Routes to the appropriate version-specific summarizer based on the
   * ScanCode version detected in the harvested data.
   *
   * @param coordinates - The entity for which we are summarizing
   * @param harvested - The set of raw tool outputs related to the identified entity
   * @returns A summary of the given raw information
   * @throws Error if the ScanCode version is invalid or data is not valid
   */
  summarize(coordinates: EntityCoordinates, harvested: ScanCodeHarvestedData): ScanCodeSummaryResult
}

/**
 * Factory function that creates a ScanCodeDelegator instance
 *
 * @param options - Configuration options for the summarizer
 * @param logger - Optional logger instance
 * @returns A new ScanCodeDelegator instance
 */
declare function scancodeSummarizerFactory(options?: SummarizerOptions, logger?: Logger): ScanCodeSummarizer

export = scancodeSummarizerFactory
