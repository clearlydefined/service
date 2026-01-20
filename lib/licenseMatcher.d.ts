// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Definition } from './utils'

/** Harvest data for a coordinate, organized by tool and version */
export interface CoordinateHarvest {
  [tool: string]: {
    [version: string]: unknown
  }
}

/** Source/target data bundle for license matching */
export interface LicenseMatchInput {
  definition: Definition
  harvest: CoordinateHarvest
}

/** A single match result entry */
export interface MatchEntry {
  policy: string
  file?: string
  propPath: string
  value: unknown
}

/** A single mismatch result entry */
export interface MismatchEntry {
  policy: string
  file?: string
  propPath: string
  source: unknown
  target: unknown
}

/** Result from comparing two license sources */
export interface CompareResult {
  match: MatchEntry[]
  mismatch: MismatchEntry[]
}

/** Final result from license matching process */
export interface LicenseMatchResult {
  isMatching: boolean
  match?: MatchEntry[]
  mismatch?: MismatchEntry[]
}

/** Interface for license match policies */
export interface LicenseMatchPolicy {
  name: string
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult
}

/**
 * Matches licenses between two versions of a component
 */
export declare class LicenseMatcher {
  /**
   * Creates a new LicenseMatcher
   * @param policies - Optional array of match policies (defaults to Definition and Harvest policies)
   */
  constructor(policies?: LicenseMatchPolicy[])

  /**
   * Compares licenses between source and target
   * @param source - Source definition and harvest data
   * @param target - Target definition and harvest data
   * @returns Match result with isMatching flag and match/mismatch details
   */
  process(source: LicenseMatchInput, target: LicenseMatchInput): LicenseMatchResult
}

/**
 * Policy that compares license files in definitions by hash and token
 */
export declare class DefinitionLicenseMatchPolicy implements LicenseMatchPolicy {
  name: string

  /**
   * Compares license files between source and target definitions
   * @param source - Source definition and harvest data
   * @param target - Target definition and harvest data
   * @returns Comparison result with matches and mismatches
   */
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult
}

/**
 * Policy that compares license information from harvest data
 */
export declare class HarvestLicenseMatchPolicy implements LicenseMatchPolicy {
  name: string

  /**
   * Compares harvest license data between source and target
   * @param source - Source definition and harvest data
   * @param target - Target definition and harvest data
   * @returns Comparison result with matches and mismatches
   */
  compare(source: LicenseMatchInput, target: LicenseMatchInput): CompareResult
}
