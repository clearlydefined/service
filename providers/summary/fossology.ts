// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SPDX from '@clearlydefined/spdx'
import lodash from 'lodash'
import type EntityCoordinates from '../../lib/entityCoordinates.ts'
import type { FileEntry } from '../../lib/utils.ts'
import { isLicenseFile, mergeDefinitions, setIfValue } from '../../lib/utils.ts'
import type { SummarizerOptions } from './index.ts'

const { get, uniq } = lodash

const noOpLicenseIds = new Set(['No_license_found', 'See-file', 'See-URL'])

/** FOSSology Nomos output */
export interface FossologyNomosOutput {
  output?: {
    content?: string
  }
  [key: string]: unknown
}

/** FOSSology Monk output */
export interface FossologyMonkOutput {
  output?: {
    content?: string
  }
  [key: string]: unknown
}

/** FOSSology Copyright output (currently not used) */
export interface FossologyCopyrightOutput {
  output?: {
    content?: {
      path: string
      output: {
        results?: { type: string; content?: string }[]
      }
    }[]
  }
  [key: string]: unknown
}

/** Harvested data structure for FOSSology tool */
export interface FossologyHarvestedData {
  nomos?: FossologyNomosOutput
  monk?: FossologyMonkOutput
  copyright?: FossologyCopyrightOutput
  [key: string]: unknown
}

/** Result of FOSSology summarization (partial Definition) */
export interface FossologySummaryResult {
  licensed?: {
    declared?: string
  }
  files?: FileEntry[]
}

/**
 * FOSSology summarizer class that processes harvested data from FOSSology tools.
 * Combines license information from Nomos and Monk scanners.
 */
export class FOSSologySummarizer {
  declare options: SummarizerOptions

  constructor(options?: SummarizerOptions) {
    this.options = options
  }

  summarize(coordinates: EntityCoordinates, harvested: FossologyHarvestedData): FossologySummaryResult {
    const result = {}
    // TODO currently definition merging does not union values (licenses, copyrights) at the file level.
    // That means the order here matters. Later merges overwrite earlier. So here we are explicitly taking
    // Nomos over Monk. The Copyright info should be orthogonal so order does not matter. In the future
    // we should resolve this merging problem but it's likely to be hard in general.
    this._summarizeMonk(result, harvested)
    this._summarizeNomos(result, harvested)
    this._summarizeCopyright(result, harvested)
    this._declareLicense(coordinates, result)
    return result
  }

  _summarizeNomos(result: FossologySummaryResult, output: FossologyHarvestedData) {
    const content = get(output, 'nomos.output.content') as string | undefined
    if (!content) {
      return
    }
    const files = content
      .split('\n')
      .map((file: string) => {
        // File package/dist/ajv.min.js contains license(s) No_license_found
        const match = /^File (.*?) contains license\(s\) (.*?)$/.exec(file)
        if (!match) {
          return null
        }
        const [, path, rawLicense] = match
        const license = noOpLicenseIds.has(rawLicense) ? null : SPDX.normalize(rawLicense)
        if (path && license) {
          return { path, license }
        }
        if (path) {
          return { path }
        }
        return null
      })
      .filter((e: FileEntry | null) => e !== null)
    mergeDefinitions(result, { files })
  }

  _summarizeMonk(result: FossologySummaryResult, output: FossologyHarvestedData) {
    const content = get(output, 'monk.output.content') as string | undefined
    if (!content) {
      return
    }
    const files = content
      .split('\n')
      .map((file: string) => {
        const fullMatch = /^found full match between \\"(.*?)\\" and \\"(.*?)\\"/.exec(file)
        if (!fullMatch) {
          return null
        }
        const [, path, rawLicense] = fullMatch
        const license = SPDX.normalize(rawLicense)
        if (path && license) {
          return { path, license }
        }
        if (path) {
          return { path }
        }
        return null
      })
      .filter((e: FileEntry | null) => e !== null)
    mergeDefinitions(result, { files })
  }

  // eslint-disable-next-line no-unused-vars
  _summarizeCopyright(_result: FossologySummaryResult, _output: FossologyHarvestedData) {
    // see https://github.com/fossology/fossology/issues/1292
    return
    // const content = get(output, 'copyright.output.content')
    // if (!content) return
    // const files = content
    //   .map(entry => {
    //     const { path, output } = entry
    //     if (!output.results) return null
    //     const attributions = uniq(
    //       output.results
    //         .filter(result => result.type === 'statement')
    //         .map(result => result.content)
    //         .filter(e => e)
    //     )
    //     const file = { path }
    //     setIfValue(file, 'attributions', attributions)
    //     return file
    //   })
    //   .filter(e => e)
    // mergeDefinitions(result, { files })
  }

  _declareLicense(coordinates: EntityCoordinates, result: FossologySummaryResult) {
    if (!result.files) {
      return
    }
    // if we know this is a license file by the name of it and it has a license detected in it
    // then let's declare the license for the component
    const licenses = uniq(
      result.files.filter(file => file.license && isLicenseFile(file.path, coordinates)).map(file => file.license)
    )
    setIfValue(result, 'licensed.declared', licenses.join(' AND '))
  }
}

export default (options?: SummarizerOptions) => new FOSSologySummarizer(options)
