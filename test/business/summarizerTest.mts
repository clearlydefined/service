// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'chai'
import SummaryService from '../../business/summarizer.ts'
import EntityCoordinates from '../../lib/entityCoordinates.ts'

const testDir = dirname(fileURLToPath(import.meta.url))

function loadEvidence(coordSpec: string): unknown {
  return JSON.parse(readFileSync(join(testDir, 'evidence', `${coordSpec.replace(/\//g, '-')}.json`), 'utf-8'))
}

describe('Summary Service', () => {
  it('should handle sourcearchive components', () => {
    const coordSpec = 'sourcearchive/mavencentral/org.apache.httpcomponents/httpcore/4.1'
    const coords = EntityCoordinates.fromString(coordSpec)
    const raw = loadEvidence(coordSpec)

    const summaryService = SummaryService({})
    const summaries = summaryService.summarizeAll(coords!, raw as any)
    const scancodeSummary = summaries['scancode']['32.3.0']
    expect(scancodeSummary.licensed.declared).to.equal('Apache-2.0')
    const licenseeSummary = summaries['licensee']['9.14.0']
    expect(licenseeSummary.licensed.declared).to.equal('Apache-2.0')
  })
})
