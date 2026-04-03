import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Summarizer from '../../business/summarizer.js'

describe('Summarizer service', () => {
  it('has the correct coordinates and tool info', () => {
    const output = buildOutput([])
    const summarizer = Summarizer({})
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarizeAll(coordinates as any, output)
    const scancode = summary.scancode['32.1.0']
    assert.notStrictEqual(scancode, null)
  })
})

function buildOutput(files) {
  return {
    scancode: {
      '32.1.0': {
        _metadata: {},
        content: {
          scancode_version: '32.1.0',
          files
        }
      }
    }
  }
}
