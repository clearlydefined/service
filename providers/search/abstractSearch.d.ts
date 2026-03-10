// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

export interface SearchOptions {
  [key: string]: any
}

/** Base class for search providers. Subclasses override the stub methods. */
export declare class AbstractSearch {
  options: SearchOptions

  constructor(options: SearchOptions)

  initialize(): Promise<void>

  /** Look up a result by coordinates. */
  get(coordinates: any): Promise<any>

  /** Suggest coordinates matching a pattern. */
  suggestCoordinates(pattern: string): Promise<string[]>

  /** Add one or more definitions to the search index. */
  store(definition: any): void

  /** Query the search index. */
  query(body: any): any

  /** Remove a definition from the search index by coordinates. */
  delete(coordinates: any): void

  /** Extract unique license expressions from a definition's facets. */
  protected _getLicenses(definition: any): string[]

  /** Extract unique attribution parties from a definition's facets. */
  protected _getAttributions(definition: any): string[]
}

export default AbstractSearch
export = AbstractSearch
