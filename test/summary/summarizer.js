// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const Summarizer = require('../../business/summarizer');

describe('Summarizer service', () => {
  it('has the correct package and tool info', () => {
    const output = buildOutput([]);
    const summarizer = Summarizer({});
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarizeAll(coordinates, output);
    expect(summary.package).to.eq(coordinates);
    const scancode = summary.scancode['2.2.1'];
    expect(scancode).to.be.not.null;
  });
});

function buildOutput(files) {
  return {
    scancode: {
      '2.2.1': {
        content: {
          scancode_version: '2.2.1',
          files
        }
      }
    }
  };
}
