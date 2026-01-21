// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type EntityCoordinates from '../../lib/entityCoordinates'
import type { FileEntry } from '../../lib/utils'
import type { SummarizerOptions } from './index'

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
export declare class ReuseSummarizer {
  /** Options passed to the summarizer */
  options: SummarizerOptions

  /**
   * Creates a new FsfeReuseSummarizer instance
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
   * @throws Error if REUSE data is invalid
   */
  summarize(coordinates: EntityCoordinates, harvested: ReuseHarvestedData): ReuseSummaryResult

  /**
   * Summarizes REUSE files into FileEntry format
   *
   * @param harvested - The harvested data
   * @returns Array of file entries or null
   */
  _summarizeFiles(harvested: ReuseHarvestedData): FileEntry[] | null

  /**
   * Adds declared license from REUSE licenses to the result
   *
   * @param harvested - The harvested data
   * @param result - The result object to modify
   */
  _addLicenseDeclaration(harvested: ReuseHarvestedData, result: ReuseSummaryResult): void
}

/**
 * Factory function that creates a FsfeReuseSummarizer instance
 *
 * @param options - Configuration options for the summarizer
 * @returns A new FsfeReuseSummarizer instance
 */
declare function reuseSummarizerFactory(options?: SummarizerOptions): ReuseSummarizer

export = reuseSummarizerFactory
