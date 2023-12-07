// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const SummaryService = require('../../business/summarizer')
const EntityCoordinates = require('../../lib/entityCoordinates')

describe('Summary Service', () => {
  it('should handle sourcearchive components', () => {
    const coordSpec = 'sourcearchive/mavencentral/org.apache.httpcomponents/httpcore/4.1'
    const coords = EntityCoordinates.fromString(coordSpec)
    const raw = require(`./evidence/${coordSpec.replace(/\//g, '-')}.json`)

    const summaryService = SummaryService({})
    const summaries = summaryService.summarizeAll(coords, raw)
    const scancodeSummary = summaries['scancode']['30.3.0']
    expect(scancodeSummary.licensed.declared).to.equal('Apache-2.0')
    const licenseeSummary = summaries['licensee']['9.14.0']
    expect(licenseeSummary.licensed.declared).to.equal('Apache-2.0')
  })
})
