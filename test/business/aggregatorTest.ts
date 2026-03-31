import assert from 'node:assert/strict'
import { assertDeepEqualInAnyOrder } from '../helpers/assert.ts'
import { describe, it } from 'node:test'
// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import AggregatorService from '../../business/aggregator.js'
import SummaryService from '../../business/summarizer.js'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import { setIfValue } from '../../lib/utils.js'


// @ts-expect-error - Node 24 runs .ts files as ESM via detect-module, but TypeScript infers CJS
const testDir = dirname(fileURLToPath(import.meta.url))

function loadEvidence(name: string): unknown {
  return JSON.parse(readFileSync(join(testDir, 'evidence', `${name}.json`), 'utf-8'))
}

describe('Aggregation service', () => {
  it('handles no tool data', async () => {
    const { service } = setupAggregator()
    const aggregated = service.process({})
    assert.strictEqual(aggregated, null)
  })

  it('handles one tool one version data', async () => {
    const summaries = { tool2: { '1.0.0': { files: [buildFile('foo.txt', 'MIT')] } } }
    const { service } = setupAggregator()
    const aggregated = service.process(summaries)
    assert.strictEqual(aggregated.files.length, 1)
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
    assert.strictEqual(aggregated.files.length, 1)
    assert.strictEqual(aggregated.files[0].path, 'foo.txt')
    assert.strictEqual(aggregated.files[0].license, 'GPL-2.0')
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
    assert.strictEqual(aggregated.files.length, 1)
    assert.strictEqual(aggregated.files[0].license, 'BSD-3-Clause AND GPL-2.0')
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
    assert.strictEqual(aggregated.files.length, 1)
    assert.strictEqual(aggregated.files[0].license, 'BSD-3-Clause AND GPL-2.0')
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
    assert.strictEqual(aggregated.files.length, 2)
    assert.strictEqual(aggregated.files[0].path, 'foo.txt')
    assert.strictEqual(aggregated.files[0].license, 'BSD-3-Clause AND GPL-2.0')
    assert.strictEqual(aggregated.files[1].path, 'bar.txt')
    assert.strictEqual(aggregated.files[1].license, 'GPL-2.0')
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
      assert.strictEqual(aggregated.licensed.declared, testcase.expected, `${testcase.name}-${testcase.version}`)
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
    assert.ok(aggregated.licensed.declared)
    // package manifest: LGPL-2.0-or-later, license: LGPL-2.1-only
    assert.notStrictEqual(aggregated.licensed.declared, 'NOASSERTION')
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
