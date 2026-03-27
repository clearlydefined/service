// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition } from '../../business/definitionService'
import type { EntityCoordinates } from '../../lib/entityCoordinates'

export interface SearchOptions {
  [key: string]: any
}

/** Base class for search providers. Subclasses override the stub methods. */
export declare class AbstractSearch {
  options: SearchOptions

  constructor(options: SearchOptions)

  initialize(): Promise<void>

  /** Look up a result by coordinates. */
  get(coordinates: EntityCoordinates): Promise<Definition | null>

  /** Suggest coordinates matching a pattern. */
  suggestCoordinates(pattern: string): Promise<string[]>

  /** Add one or more definitions to the search index. */
  store(definition: Definition): void

  /** Query the search index. */
  query(body: Record<string, unknown>): unknown

  /** Remove a definition from the search index by coordinates. */
  delete(coordinates: EntityCoordinates): void

  /** Extract unique license expressions from a definition's facets. */
  protected _getLicenses(definition: Definition): string[]

  /** Extract unique attribution parties from a definition's facets. */
  protected _getAttributions(definition: Definition): string[]
}

export default AbstractSearch
export = AbstractSearch
