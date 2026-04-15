// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { expect } from 'chai'
import Summarizer from '../../business/summarizer.ts'

describe('Summarizer service', () => {
  it('has the correct coordinates and tool info', () => {
    const output = buildOutput([])
    const summarizer = Summarizer({})
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarizeAll(coordinates as any, output)
    const scancode = summary.scancode['32.1.0']
    expect(scancode).to.be.not.null
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
