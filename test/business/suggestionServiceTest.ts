import assert from 'node:assert/strict'
import { assertDeepEqualInAnyOrder } from '../helpers/assert.ts'
import { describe, it, mock } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import lodash from 'lodash'
import { DateTime } from 'luxon'
import SuggestionService from '../../business/suggestionService.js'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import { setIfValue } from '../../lib/utils.js'

const { get } = lodash


// @ts-expect-error - Node 24 runs .ts files as ESM via detect-module, but TypeScript infers CJS
const testDir = dirname(fileURLToPath(import.meta.url))

const testCoordinates = EntityCoordinates.fromString('npm/npmjs/-/test/10.0')

describe('Suggestion Service', () => {
  it('gets suggestion for missing declared license', async () => {
    const now = DateTime.now()
    const definition = createDefinition(testCoordinates, now, null, files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [before1, before2, after]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    assert.notStrictEqual(suggestions, null)
    assert.deepStrictEqual(service.definitionService.find.mock.calls[0].arguments[0], {
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
    const declared = get(suggestions, 'licensed.declared')
    assertDeepEqualInAnyOrder(declared, [
      { value: 'GPL', version: '102.0' },
      { value: 'MIT', version: '10-5.0' },
      { value: 'MIT', version: '10-3.0' }
    ])
  })

  it('sorts suggestion by releaseDate', async () => {
    const now = DateTime.now()
    const definition = createDefinition(testCoordinates, now, null, files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [after, before2, before1]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    assert.notStrictEqual(suggestions, null)
    assert.deepStrictEqual(service.definitionService.find.mock.calls[0].arguments[0], {
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
    const declared = get(suggestions, 'licensed.declared')
    assertDeepEqualInAnyOrder(declared, [
      { value: 'MIT', version: '10-3.0' },
      { value: 'MIT', version: '10-5.0' },
      { value: 'GPL', version: '102.0' }
    ])
  })

  it('gets no suggestions for definition with declared license', async () => {
    const now = DateTime.now()
    const definition = createDefinition(testCoordinates, now, 'MIT', files)
    const before1 = createModifiedDefinition(testCoordinates, now, -3, 'MIT', files, attributions)
    const before2 = createModifiedDefinition(testCoordinates, now, -5, 'MIT', files, attributions)
    const after = createModifiedDefinition(testCoordinates, now, 2, 'GPL', files, attributions)
    const others = [before1, before2, after]
    const service = setup(definition, others)
    const suggestions = await service.get(testCoordinates)
    assert.strictEqual(suggestions, null)
    assert.deepStrictEqual(service.definitionService.find.mock.calls[0].arguments[0], {
      type: 'npm',
      provider: 'npmjs',
      name: 'test',
      namespace: null
    })
  })

  it('returns no suggestions if there are no related definitions AND no discoveries', async () => {
    const now = DateTime.now()
    const definition = createDefinition(testCoordinates, now, null, files)
    const service = setup(definition, [])
    const suggestions = await service.get(testCoordinates)
    assert.strictEqual(suggestions, null)
  })

  it('queries related definitions with namespace', async () => {
    const now = DateTime.now()
    const coordinates = EntityCoordinates.fromString('npm/npmjs/@scope/scope-test/1.0.0')
    const definition = createDefinition(coordinates, now, null, files)
    const service = setup(definition, [])
    await service.get(coordinates)
    assert.deepStrictEqual(service.definitionService.find.mock.calls[0].arguments[0], {
      type: 'npm',
      provider: 'npmjs',
      name: 'scope-test',
      namespace: '@scope'
    })
  })

  it("will include 'discovered' licenses for declared license suggestions", async () => {
    const t2 = EntityCoordinates.fromString('gem/rubygems/-/autobuild/1.6.2.b8')
    const sample_definition = JSON.parse(readFileSync(join(testDir, 'evidence', 'issue-453-sample-1.json'), 'utf-8'))
    const service = setup(sample_definition, [])
    const suggestions = await service.get(t2)
    assert.notStrictEqual(suggestions, null)
    const declared = get(suggestions, 'licensed.declared')
    assertDeepEqualInAnyOrder(declared, [{ value: 'GPL-2.0', version: '1.6.2.b8' }])
  })
})

const attributions = ['test', 'test2', 'test3']
const files = [{ path: 'test.txt' }, { path: 'test2.txt' }, { path: 'test3.txt' }]

function createModifiedDefinition(
  coordinates: EntityCoordinates,
  now: DateTime,
  amount: number,
  license: string,
  files: Record<string, unknown>[],
  attributions: string[]
) {
  const newCoordinates = EntityCoordinates.fromObject({
    ...coordinates,
    revision: `${coordinates.revision.split('.')[0] + amount}.0`
  })
  const newFiles = files.map(file => {
    return { ...file, license, attributions }
  })
  const newDate = now.plus({ days: amount })
  return createDefinition(newCoordinates, newDate, license, newFiles)
}

function createDefinition(
  coordinates: EntityCoordinates,
  releaseDate: DateTime,
  license: string | null,
  files: Record<string, unknown>[]
) {
  const result: Record<string, unknown> = { coordinates }
  setIfValue(result, 'licensed.declared', license)
  setIfValue(result, 'described.releaseDate', releaseDate.toISODate())
  setIfValue(result, 'files', files)
  return result
}

function setup(definition: Record<string, unknown>, others: Record<string, unknown>[]) {
  const definitionService = { find: mock.fn(async () => ({ data: [...others, definition] })) }
  return (SuggestionService as (...args: any[]) => any)(definitionService)
}
