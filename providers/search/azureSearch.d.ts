// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AbstractSearch } from './abstractSearch.ts'

export interface AzureSearchOptions {
  /** Azure Search service name (used in the URL template). */
  service: string
  /** Azure Search admin API key. */
  apiKey: string
  /** Connection string for the Azure Blob data source backing the index. */
  dataSourceConnectionString: string
  /** Container name in the Azure Blob data source. */
  dataSourceContainerName: string
}

export declare class AzureSearch extends AbstractSearch {
  options: AzureSearchOptions

  constructor(options: AzureSearchOptions)

  initialize(): Promise<void>
  suggestCoordinates(pattern: string): Promise<string[]>
  query(body: any): Promise<any>
}

/**
 * Factory function to create an AzureSearch instance.
 *
 * @param options - Azure Search configuration
 * @returns A new AzureSearch instance
 */
declare function createAzureSearch(options: AzureSearchOptions): AzureSearch

export default createAzureSearch
