// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AbstractSearch, SearchOptions } from './abstractSearch.js'

/** In-memory search index entry. */
export interface SearchEntry {
  coordinates: string
  releaseDate?: string
  declaredLicense?: string
  discoveredLicenses: string[]
  attributionParties: string[]
}

export declare class MemorySearch extends AbstractSearch {
  index: Record<string, SearchEntry>

  constructor(options: SearchOptions)

  suggestCoordinates(pattern: string): Promise<string[]>
  store(definitions: any | any[]): void
  query(body: { count?: boolean }): Promise<{ count: number }>
  delete(coordinates: { toString(): string }): void
}

/**
 * Factory function to create a MemorySearch instance.
 *
 * @param options - Search options
 * @returns A new MemorySearch instance
 */
declare function createMemorySearch(options: SearchOptions): MemorySearch

export default createMemorySearch
