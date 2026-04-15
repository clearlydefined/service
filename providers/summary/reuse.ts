// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SPDX from '@clearlydefined/spdx'
import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../lib/utils.ts'
import { isDeclaredLicense, setIfValue } from '../../lib/utils.ts'
import type { SummarizerOptions } from './index.ts'

const { get, uniq } = lodash

/** REUSE license information */
export interface ReuseLicense {
  spdxId?: string
  filePath?: string
  [key: string]: unknown
}

/** REUSE file information */
export interface ReuseFile {
  FileName: string
  LicenseConcluded?: string
  LicenseInfoInFile?: string
  FileChecksumSHA1?: string
  FileCopyrightText?: string
  [key: string]: unknown
}

/** REUSE metadata */
export interface ReuseMetadata {
  CreatorTool?: string
  [key: string]: unknown
}

/** REUSE tool output */
export interface ReuseTool {
  metadata?: ReuseMetadata
  files?: ReuseFile[]
  licenses?: ReuseLicense[]
  [key: string]: unknown
}

/** Attachment information */
export interface ReuseAttachment {
  path: string
  token?: string
  [key: string]: unknown
}

/** Harvested data structure for REUSE tool */
export interface ReuseHarvestedData {
  reuse?: ReuseTool
  attachments?: ReuseAttachment[]
  [key: string]: unknown
}

/** Result of REUSE summarization (partial Definition) */
export interface ReuseSummaryResult {
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * FSFE REUSE summarizer class that processes harvested data from the REUSE tool.
 * Extracts license and copyright information following the REUSE specification.
 */
export class ReuseSummarizer {
  declare options: SummarizerOptions | undefined

  constructor(options?: SummarizerOptions) {
    this.options = options
  }

  summarize(_coordinates: EntityCoordinates, harvested: ReuseHarvestedData): ReuseSummaryResult {
    if (!harvested?.reuse?.metadata!.CreatorTool) {
      throw new Error('Invalid REUSE data')
    }
    const result = {}

    setIfValue(result, 'files', this._summarizeFiles(harvested))
    this._addLicenseDeclaration(harvested, result)
    return result
  }

  _summarizeFiles(harvested: ReuseHarvestedData): FileEntry[] | null {
    const files = get(harvested, 'reuse.files') as ReuseFile[] | undefined
    if (!files) {
      return null
    }
    const licenseFiles: FileEntry[] = []
    const attachments = harvested.attachments || []
    const licenses = get(harvested, 'reuse.licenses') as ReuseLicense[] | undefined
    if (licenses) {
      for (const license of licenses) {
        const licenseSpdxId = license.spdxId ? SPDX.normalize(license.spdxId) : null
        if (license.filePath && isDeclaredLicense(licenseSpdxId)) {
          const attachment = attachments.find(x => x.path === license.filePath)
          const licenseFile: FileEntry = { path: license.filePath, license: licenseSpdxId!, natures: ['license'] }
          setIfValue(licenseFile, 'token', get(attachment, 'token'))
          licenseFiles.push(licenseFile)
        }
      }
    }
    return files
      .map(file => {
        const path = file.FileName
        let declaredLicense = file.LicenseConcluded
        if (!isDeclaredLicense(declaredLicense)) {
          declaredLicense = file.LicenseInfoInFile
        }
        const license = declaredLicense ? SPDX.normalize(declaredLicense) : null
        if (path && isDeclaredLicense(license)) {
          const resultFile: FileEntry = { path, license: license!, hashes: { sha1: file.FileChecksumSHA1! } }
          if (file.FileCopyrightText && file.FileCopyrightText !== 'NONE') {
            resultFile.attributions = [file.FileCopyrightText]
          }
          return resultFile
        }
        return null
      })
      .concat(licenseFiles)
      .filter((e: FileEntry | null) => e !== null)
  }

  _addLicenseDeclaration(harvested: ReuseHarvestedData, result: ReuseSummaryResult) {
    if (!harvested.reuse?.licenses) {
      return
    }
    const declaredLicenses = harvested.reuse.licenses
      .map(license => (license.spdxId && isDeclaredLicense(SPDX.normalize(license.spdxId)) ? license.spdxId : null))
      .filter((x): x is string => x !== null)
    setIfValue(result, 'licensed.declared', uniq(declaredLicenses).join(' AND '))
  }
}

export default (options?: SummarizerOptions) => new ReuseSummarizer(options)
