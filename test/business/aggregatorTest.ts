// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chai from 'chai'
import deepEqualInAnyOrder from 'deep-equal-in-any-order'
import AggregatorService from '../../business/aggregator.js'
import SummaryService from '../../business/summarizer.js'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import { setIfValue } from '../../lib/utils.js'

chai.use(deepEqualInAnyOrder)
const expect = chai.expect

// @ts-expect-error - Node 24 runs .ts files as ESM via detect-module, but TypeScript infers CJS
const testDir = dirname(fileURLToPath(import.meta.url))

function loadEvidence(name: string): unknown {
  return JSON.parse(readFileSync(join(testDir, 'evidence', `${name}.json`), 'utf-8'))
}

describe('Aggregation service', () => {
  it('handles no tool data', async () => {
    const { service } = setupAggregator()
    const aggregated = service.process({})
    expect(aggregated).to.be.null
  })

  it('handles one tool one version data', async () => {
    const summaries = { tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] } } }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
  })

  it('handles one tool multiple version data', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT'), buildFile('bar.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.eq('GPL-2.0')
  })

  it('handles multiple tools and one file data', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: { '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause')] } }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
  })

  it('handles multiple tools and multiple file data with extras ignored', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: {
        '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause')] },
        '2.0.0': { files: [buildFile('bar.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(1)
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
  })

  it('handles multiple tools and multiple file data with extras included', async () => {
    const summaries = {
      tool2: {
        '1.0.0': { files: [buildFile('foo.txt', 'MIT')] },
        '2.0.0': { files: [buildFile('foo.txt', 'GPL-2.0')] }
      },
      tool1: {
        '3.0.0': { files: [buildFile('foo.txt', 'BSD-3-Clause'), buildFile('bar.txt', 'GPL-2.0')] },
        '2.0.0': { files: [buildFile('bar.txt', 'GPL-2.0')] }
      }
    }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    expect(aggregated.files.length).to.eq(2)
    expect(aggregated.files[0].path).to.eq('foo.txt')
    expect(aggregated.files[0].license).to.equal('BSD-3-Clause AND GPL-2.0')
    expect(aggregated.files[1].path).to.eq('bar.txt')
    expect(aggregated.files[1].license).to.eq('GPL-2.0')
  })

  it('handles Rust crates with license choices', async () => {
    const testcases = [
      {
        name: 'slog',
        version: '2.7.0',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'MPL-2.0 OR MIT OR Apache-2.0'
      },
      {
        name: 'quote',
        version: '0.6.4',
        tools: [['clearlydefined', 'fossology', 'licensee', 'scancode']],
        expected: 'MIT OR Apache-2.0'
      },
      {
        name: 'quote',
        version: '1.0.9',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'MIT OR Apache-2.0'
      },
      {
        name: 'rand',
        version: '0.8.2',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'MIT OR Apache-2.0'
      },
      {
        name: 'regex',
        version: '1.5.3',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'MIT OR Apache-2.0'
      },
      {
        name: 'serde',
        version: '1.0.123',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'MIT OR Apache-2.0'
      },
      {
        name: 'mpmc',
        version: '0.1.6',
        tools: [['clearlydefined', 'licensee', 'scancode']],
        expected: 'BSD-2-Clause-Views'
      }
    ]

    const summaryService = (SummaryService as (...args: any[]) => any)({})

    for (const testcase of testcases) {
      const coordSpec = `crate/cratesio/-/${testcase.name}/${testcase.version}`
      const coords = EntityCoordinates.fromString(coordSpec)
      const raw = loadEvidence(`crate-${testcase.name}-${testcase.version}`)
      const tools = testcase.tools
      const summaries = summaryService.summarizeAll(coords, raw)
      const { service } = setupAggregatorWithParams(coordSpec, tools)
      const aggregated = service.process(summaries, coords)
      expect(aggregated.licensed.declared, `${testcase.name}-${testcase.version}`).to.eq(testcase.expected)
    }
  })

  it('should handle composer/packagist components', () => {
    const tools = [['clearlydefined', 'licensee', 'scancode', 'reuse']]
    const coordSpec = 'composer/packagist/mmucklo/krumo/0.7.0'
    const coords = EntityCoordinates.fromString(coordSpec)
    const raw = loadEvidence(coordSpec.replace(/\//g, '-'))

    const summaryService = (SummaryService as (...args: any[]) => any)({})
    const summaries = summaryService.summarizeAll(coords, raw)
    const { service } = setupAggregatorWithParams(coordSpec, tools)
    const aggregated = service.process(summaries, coords)
    expect(aggregated.licensed.declared).to.be.ok
    // package manifest: LGPL-2.0-or-later, license: LGPL-2.1-only
    expect(aggregated.licensed.declared).to.be.not.equal('NOASSERTION')
  })
})

function buildFile(path: string, license?: string, holders?: string[]) {
  const result: Record<string, unknown> = { path }
  setIfValue(result, 'license', license)
  setIfValue(result, 'attributions', holders ? holders.map(entry => `Copyright ${entry}`) : null)
  return result
}

function setupAggregator() {
  const coordinates = EntityCoordinates.fromString('npm/npmjs/-/test/1.0')
  const config = { precedence: [['tool1', 'tool2', 'tool3']] }
  const service = (AggregatorService as (...args: any[]) => any)(config)
  return { service, coordinates }
}

function setupAggregatorWithParams(coordSpec: string, tool_precedence: string[][]) {
  const coordinates = EntityCoordinates.fromString(coordSpec)
  const config = { precedence: tool_precedence }
  const service = (AggregatorService as (...args: any[]) => any)(config)
  return { service, coordinates }
}
