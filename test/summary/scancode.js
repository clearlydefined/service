// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const Summarizer = require('../../providers/summary/scancode');

describe('ScanCode summarizer', () => {
  it('has the right package info', () => {
    const harvested = buildOutput([]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.package).to.eq(coordinates);
  });

  it('gets all the copyright holders', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', 'MIT', [['Bob', 'Fred']]),
      buildFile('/bar.txt', 'MIT', [['Jane', 'Fred']])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(2);
    const copyright = summary.licensed.copyright;
    expect(copyright.holders.length).to.eq(3);
    expect(copyright.holders).to.include('Bob');
    expect(copyright.holders).to.include('Jane');
    expect(copyright.holders).to.include('Fred');
    expect(copyright.missing).to.eq(0);
  });

  it('gets all the licenses', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', 'MIT', []),
      buildFile('/bar.txt', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const license = summary.licensed.license;
    expect(license.expression).to.include('MIT');
    expect(license.expression).to.include('GPL');
    expect(license.missing).to.eq(0);
  });

  it('records missing licenses and holders', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', null, [['bob']]),
      buildFile('/bar.txt', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const copyright = summary.licensed.copyright;
    expect(copyright.holders.length).to.eq(1);
    expect(copyright.holders).to.include('bob');
    expect(copyright.missing).to.eq(1);
    const license = summary.licensed.license;
    expect(license.expression).to.eq('GPL');
    expect(license.missing).to.eq(1);
  });

  it('handles files with no data', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', null, null),
      buildFile('/bar.txt', null, null)
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(2);
    const copyright = summary.licensed.copyright;
    expect(copyright.holders.length).to.eq(0);
    expect(copyright.missing).to.eq(2);
    const license = summary.licensed.license;
    expect(license.expression).to.eq(null);
    expect(license.missing).to.eq(2);
  });

  it('handles scan with no files', () => {
    const harvested = buildOutput([]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(0);
    const copyright = summary.licensed.copyright;
    expect(copyright.holders.length).to.eq(0);
    expect(copyright.missing).to.eq(0);
    const license = summary.licensed.license;
    expect(license.expression).to.eq(null);
    expect(license.missing).to.eq(0);
  });
});

function buildOutput(files) {
  return {
    content: {
      scancode_version: '2.2.1',
      files
    }
  };
}

function buildFile(path, license, holders) {
  return {
    path,
    licenses: license ? [{ spdx_license_key: license }] : null,
    copyrights: holders
      ? holders.map(entry => {
          return { holders: entry };
        })
      : null
  };
}
