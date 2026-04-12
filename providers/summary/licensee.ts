// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SPDX from '@clearlydefined/spdx'
import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../lib/utils.ts'
import { isDeclaredLicense, isLicenseFile, setIfValue } from '../../lib/utils.ts'
import type { SummarizerOptions } from './index.ts'

const { get, uniq } = lodash

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
export class LicenseeSummarizer {
  declare options: SummarizerOptions

  constructor(options?: SummarizerOptions) {
    this.options = options
  }

  summarize(coordinates: EntityCoordinates, harvested: LicenseeHarvestedData): LicenseeSummaryResult {
    if (!harvested?.licensee?.version) {
      throw new Error('Invalid Licensee data')
    }
    const result = {}
    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseFromFiles(result, coordinates)
    return result
  }

  _summarizeFiles(harvested: LicenseeHarvestedData): FileEntry[] | null {
    const files = get(harvested, 'licensee.output.content.matched_files') as LicenseeMatchedFile[] | undefined
    const attachments = harvested.attachments || []
    if (!files) {
      return null
    }
    return files
      .map(file => {
        if (get(file, 'matcher.name') !== 'exact') {
          return null
        }
        if (80 > +get(file, 'matcher.confidence')) {
          return null
        }
        const path = file.filename
        const attachment = attachments.find(x => x.path === path)
        const license = SPDX.normalize(file.matched_license)
        if (path && isDeclaredLicense(license)) {
          const resultFile: FileEntry = { path, license, natures: ['license'] }
          setIfValue(resultFile, 'token', get(attachment, 'token'))
          return resultFile
        }
        return null
      })
      .filter((e: FileEntry | null) => e !== null)
  }

  _addLicenseFromFiles(result: LicenseeSummaryResult, coordinates: EntityCoordinates) {
    if (!result.files) {
      return
    }
    const licenses = result.files
      .map(file => (isDeclaredLicense(file.license) && isLicenseFile(file.path, coordinates) ? file.license : null))
      .filter(x => x)
    setIfValue(result, 'licensed.declared', uniq(licenses).join(' AND '))
  }
}

export default (options?: SummarizerOptions) => new LicenseeSummarizer(options)
