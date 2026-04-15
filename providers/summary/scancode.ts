// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../lib/utils.ts'
import type { Logger } from '../logging/index.js'
import type { SummarizerOptions } from './index.ts'

const { get } = lodash

import { gte } from 'semver'
import LoggerFactory from '../logging/logger.ts'
import ScanCodeLegacySummarizer from './scancode/legacy-summarizer.ts'
import ScanCodeNewSummarizer from './scancode/new-summarizer.ts'

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
export class ScanCodeSummarizer {
  declare options: SummarizerOptions
  declare logger: Logger

  constructor(options: SummarizerOptions, logger: Logger = LoggerFactory()) {
    this.options = options
    this.logger = logger
  }

  summarize(coordinates: EntityCoordinates, harvested: ScanCodeHarvestedData): ScanCodeSummaryResult {
    const scancodeVersion = (get(harvested, 'content.headers[0].tool_version') ||
      get(harvested, 'content.scancode_version')) as string | undefined
    if (!scancodeVersion) {
      throw new Error('Not valid ScanCode data')
    }

    if (gte(scancodeVersion, '32.1.0')) {
      return ScanCodeNewSummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
    }

    return ScanCodeLegacySummarizer(this.options, this.logger).summarize(scancodeVersion, coordinates, harvested)
  }
}

export default (options?: SummarizerOptions, logger?: Logger) => new ScanCodeSummarizer(options!, logger)
