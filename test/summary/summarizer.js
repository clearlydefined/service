// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const Summarizer = require('../../business/summarizer')

describe('Summarizer service', () => {
  it('has the correct coordinates and tool info', () => {
    const output = buildOutput([])
    const summarizer = Summarizer({})
    const coordinates = 'npm/npmjs/-/test/1.0'
    const summary = summarizer.summarizeAll(coordinates, output)
    const scancode = summary.scancode['32.0.8']
    expect(scancode).to.be.not.null
  })
})

function buildOutput(files) {
  return {
    scancode: {
      '32.0.8': {
        _metadata: {},
        content: {
          scancode_version: '32.0.8',
          files
        }
      }
    }
  }
}
