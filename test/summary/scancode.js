// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const { expect } = require('chai');
const Summarizer = require('../../providers/summary/scancode');

describe('ScanCode summarizer', () => {
  it('has the no coordinates info', () => {
    const harvested = buildOutput([]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.coordinates).to.be.undefined;
  });

  it('gets all the attribution parties', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', 'MIT', [['Bob', 'Fred']]),
      buildFile('/bar.txt', 'MIT', [['Jane', 'Fred']])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(2);
    const attribution = summary.licensed.attribution;
    expect(attribution.parties.length).to.eq(3);
    expect(attribution.parties).to.include('Bob');
    expect(attribution.parties).to.include('Jane');
    expect(attribution.parties).to.include('Fred');
    expect(attribution.unknown).to.eq(0);
  });

  it('gets all the discovered licenses', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', 'MIT', []),
      buildFile('/bar.txt', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.include('MIT');
    expect(discovered.expression).to.include('GPL');
    expect(discovered.unknown).to.eq(0);
  });

  it('records unknown licenses and parties', () => {
    const harvested = buildOutput([
      buildFile('/foo.txt', null, [['bob']]),
      buildFile('/bar.txt', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const attribution = summary.licensed.attribution;
    expect(attribution.parties.length).to.eq(1);
    expect(attribution.parties).to.include('bob');
    expect(attribution.unknown).to.eq(1);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq('GPL');
    expect(discovered.unknown).to.eq(1);
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
    const attribution = summary.licensed.attribution;
    expect(attribution.parties.length).to.eq(0);
    expect(attribution.unknown).to.eq(2);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq(null);
    expect(discovered.unknown).to.eq(2);
    const declared = summary.licensed.declared;
    expect(discovered.declared).to.eq(undefined);
  });

  it('handles scan with no files', () => {
    const harvested = buildOutput([]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(0);
    const attribution = summary.licensed.attribution;
    expect(attribution.parties.length).to.eq(0);
    expect(attribution.unknown).to.eq(0);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq(null);
    expect(discovered.unknown).to.eq(0);
    const declared = summary.licensed.declared;
    expect(discovered.declared).to.eq(undefined);
  });
  
  it('handles scan LICENSE file', () => {
    const harvested = buildOutput([
      buildFile('LICENSE', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(2);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq('MIT and GPL');
    expect(discovered.unknown).to.eq(0);
    const declared = summary.licensed.declared;
    expect(declared).to.eq('MIT');
  });
    
  it('handles scan with asserted license file', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(1);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq(null);
    expect(discovered.unknown).to.eq(1);
    const declared = summary.licensed.declared;
    expect(declared).to.eq('MIT');
  });
    
  it('handles scan with both asserted discovered license file', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    expect(summary.licensed.files).to.eq(2);
    const discovered = summary.licensed.discovered;
    expect(discovered.expression).to.eq('GPL');
    expect(discovered.unknown).to.eq(1);
    const declared = summary.licensed.declared;
    expect(declared).to.eq('MIT');
  });
});

function buildOutput(files) {
  return {
    _metadata: { },
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
      ? holders.map(entry => { return { holders: entry }; })
      : null
  };
}
  
function buildPackageFile(path, license) {
  return {
    path,
    packages: [
      { asserted_licenses: license ? [{ spdx_license_key: license }] : null }
    ]
  };
}
