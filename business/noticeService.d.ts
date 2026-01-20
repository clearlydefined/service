// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../lib/entityCoordinates'
import type { Logger } from '../providers/logging'
import type { DefinitionService } from './definitionService'

/** Supported output formats for notice generation */
export type NoticeOutputFormat = 'text' | 'html' | 'template' | 'json'

/** Options for notice generation */
export interface NoticeOptions {
  /** Template string for template renderer */
  template?: string
}

/** Package entry for notice generation */
export interface NoticePackage {
  /** Package name (namespace/name) */
  name: string
  /** Package version */
  version: string
  /** Declared license expression */
  license: string
  /** Copyright statements */
  copyrights: string[]
  /** Project website URL */
  website: string
  /** License text content */
  text: string
}

/** Warning summary for notice generation */
export interface NoticeWarnings {
  /** Coordinates with no definition available */
  noDefinition: string[]
  /** Coordinates with no declared license */
  noLicense: string[]
  /** Coordinates with no copyright information */
  noCopyright: string[]
}

/** Summary of notice generation */
export interface NoticeSummary {
  /** Total number of coordinates requested */
  total: number
  /** Warning information */
  warnings: NoticeWarnings
}

/** Result of notice generation */
export interface NoticeResult {
  /** The generated notice content */
  content: string
  /** Summary of the generation */
  summary: NoticeSummary
}

/** Packages result from internal processing */
export interface PackagesResult {
  /** List of packages for notice generation */
  packages: NoticePackage[]
  /** Coordinates with no definition */
  noDefinition: string[]
  /** Coordinates with no license */
  noLicense: string[]
  /** Coordinates with no copyright */
  noCopyright: string[]
}

/** Attachment store interface */
export interface AttachmentStore {
  /**
   * Get attachment content by token
   *
   * @param token - The attachment token
   * @returns The attachment content
   */
  get(token: string): Promise<string>
}

/**
 * Service for generating attribution notices from definitions.
 * Supports multiple output formats including text, HTML, and JSON.
 */
export declare class NoticeService {
  /** Definition service instance */
  protected definitionService: DefinitionService

  /** Attachment store instance */
  protected attachmentStore: AttachmentStore

  /** Logger instance */
  protected logger: Logger

  /**
   * Creates a new NoticeService instance
   *
   * @param definitionService - Service for retrieving definitions
   * @param attachmentStore - Store for retrieving license text attachments
   */
  constructor(definitionService: DefinitionService, attachmentStore: AttachmentStore)

  /**
   * Generate an attribution notice for the given components.
   *
   * @param coordinates - Array of component coordinates to include
   * @param output - Output format ('text', 'html', 'template', 'json')
   * @param options - Additional options for generation
   * @returns The generated notice and summary
   * @throws Error if template renderer is used without a template option
   */
  generate(
    coordinates: EntityCoordinates[],
    output?: NoticeOutputFormat | null,
    options?: NoticeOptions | null
  ): Promise<NoticeResult>
}

/**
 * Factory function to create a NoticeService instance
 *
 * @param definitionService - Service for retrieving definitions
 * @param attachmentStore - Store for retrieving license text attachments
 * @returns A new NoticeService instance
 */
declare function createNoticeService(
  definitionService: DefinitionService,
  attachmentStore: AttachmentStore
): NoticeService

export default createNoticeService
export = createNoticeService
