// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const Summarizer = require('../../business/summarizer');

describe('Summarizer service', () => {
  it('has the correct coordinates and tool info', () => {
    const output = buildOutput([]);
    const summarizer = Summarizer({});
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarizeAll(coordinates, output);
    expect(summary.coordinates).to.eq(coordinates);
    const scancode = summary.scancode['2.2.1'];
    expect(scancode).to.be.not.null;
  });
});

function buildOutput(files) {
  return {
    scancode: {
      '2.2.1': {
        _metadata: {},
        content: {
          scancode_version: '2.2.1',
          files
        }
      }
    }
  };
}
