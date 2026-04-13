// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type Curation from '../../lib/curation.ts'
import type { CurationData } from '../../lib/curation.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { Logger } from '../logging/index.js'
import logger from '../logging/logger.ts'
import type { Contribution, ContributionPR } from './index.js'

// TODO: implements ICurationStore once return types are aligned
class MemoryStore {
  declare logger: Logger
  declare options: Record<string, unknown> | undefined
  declare curations: Record<string, CurationData>
  declare contributions: Record<number, Contribution>

  constructor(options?: Record<string, unknown>) {
    this.logger = logger()
    this.options = options
    this.curations = {}
    this.contributions = {}
  }

  initialize() {}

  updateCurations(curations: Curation[]) {
    for (const curation of curations) {
      const coordinates = EntityCoordinates.fromObject(curation.data.coordinates)
      this.curations[this._getCurationId(coordinates)] = curation.data
    }
  }

  getContribution(prNumber: number) {
    return this.contributions[prNumber]
  }

  updateContribution(pr: ContributionPR, curations: Curation[] | null = null) {
    if (curations) {
      const files: Record<string, CurationData> = {}
      for (const curation of curations) {
        files[curation.path] = curation.data
      }
      this.contributions[pr.number] = { pr, files }
      return
    }
    const current = this.contributions[pr.number]
    const files: Record<string, CurationData> = current ? (current.files as Record<string, CurationData>) : {}
    this.contributions[pr.number] = { pr, files }
  }

  list(coordinates: EntityCoordinates) {
    if (!coordinates) {
      throw new Error('must specify coordinates to list')
    }
    const pattern = this._getCurationId(coordinates)
    return Object.keys(this.curations)
      .filter(key => key.startsWith(pattern))
      .map(key => this.curations[key])
  }

  listAll(coordinatesList: EntityCoordinates[]) {
    const result: Record<string, CurationData[]> = {}
    for (const coordinates of coordinatesList) {
      const data = this.list(coordinates)
      if (!data) {
        continue
      }
      const key = coordinates.toString()
      result[key] = data
    }
    return result
  }

  _getCurationId(coordinates: EntityCoordinates) {
    if (!coordinates) {
      return ''
    }
    return EntityCoordinates.fromObject(coordinates).toString().toLowerCase()
  }
}

export default (options?: Record<string, unknown>) => new MemoryStore(options)
