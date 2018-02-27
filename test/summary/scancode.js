// Copyright (c) Microsoft Corporation.
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
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(2);
    const attribution = core.attribution;
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
    const core = summary.licensed.facets.core;
    const discovered = core.discovered;
    expect(discovered.expressions).to.include('MIT');
    expect(discovered.expressions).to.include('GPL');
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
    const core = summary.licensed.facets.core;
    const attribution = core.attribution;
    expect(attribution.parties.length).to.eq(1);
    expect(attribution.parties).to.include('bob');
    expect(attribution.unknown).to.eq(1);
    const discovered = core.discovered;
    expect(discovered.expressions).to.include('GPL');
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
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(2);
    const attribution = core.attribution;
    expect(attribution.parties).to.be.null;
    expect(attribution.unknown).to.eq(2);
    const discovered = core.discovered;
    expect(discovered.expressions).to.eq(null);
    expect(discovered.unknown).to.eq(2);
    const declared = core.declared;
    expect(declared).to.eq(null);
  });

  it('handles scan with no files', () => {
    const harvested = buildOutput([]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(0);
    const attribution = core.attribution;
    expect(attribution.parties).to.be.null;
    expect(attribution.unknown).to.eq(0);
    const discovered = core.discovered;
    expect(discovered.expressions).to.be.null;
    expect(discovered.unknown).to.eq(0);
    const declared = core.declared;
    expect(declared).to.eq(null);
  });
  
  it('handles scan LICENSE file', () => {
    const harvested = buildOutput([
      buildFile('LICENSE', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(2);
    const discovered = core.discovered;
    expect(discovered.expressions).to.include('MIT');
    expect(discovered.expressions).to.include('GPL');
    expect(discovered.unknown).to.eq(0);
    const declared = core.declared;
    expect(declared).to.deep.eq(['MIT']);
  });
    
  it('handles scan with asserted license file', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(1);
    const discovered = core.discovered;
    expect(discovered.expressions).to.be.null;
    expect(discovered.unknown).to.eq(0);
    const declared = core.declared;
    expect(declared).to.deep.eq(['MIT']);
  });
    
  it('handles scan with both asserted discovered license file', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(2);
    const discovered = core.discovered;
    expect(discovered.expressions).to.deep.eq(['GPL']);
    expect(discovered.unknown).to.eq(0);
    const declared = core.declared;
    expect(declared).to.deep.eq(['MIT']);
  });
    
  it('summarizes with empty object facets', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested, {});
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(2);
    const discovered = core.discovered;
    expect(discovered.expressions).to.deep.eq(['GPL']);
    expect(discovered.unknown).to.eq(0);
    const declared = core.declared;
    expect(declared).to.deep.eq(['MIT']);
  });
    
  it('summarizes with basic filters', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const facets = { tests: ['*.json'] };
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested, facets);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(1);
    const discovered = core.discovered;
    expect(discovered.expressions).to.deep.eq(['GPL']);
    expect(discovered.unknown).to.eq(0);
    const tests = summary.licensed.facets.tests;
    expect(tests.files).to.eq(1);
    const declared = tests.declared;
    expect(declared).to.deep.eq(['MIT']);
    expect(!!tests.discovered.expressions).to.be.false;
    expect(tests.discovered.unknown).to.eq(0);
  });

  it('summarizes with no core filters', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const facets = { tests: ['*.json'] };
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested, facets);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(1);
    const discovered = core.discovered;
    expect(discovered.expressions).to.deep.eq(['GPL']);
    expect(discovered.unknown).to.eq(0);
    const tests = summary.licensed.facets.tests;
    expect(tests.files).to.eq(1);
    const declared = tests.declared;
    expect(declared).to.deep.eq(['MIT']);
    expect(!!tests.discovered.expressions).to.be.false;
    expect(tests.discovered.unknown).to.eq(0);
  });
  
  it('summarizes with everything grouped into non-core facet', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.foo', 'GPL', [])
    ]);
    const facets = { tests: ['*.json'], dev: ['*.foo'] };
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested, facets);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(0);
    const dev = summary.licensed.facets.dev;
    expect(dev.files).to.eq(1);
    const discovered = dev.discovered;
    expect(discovered.expressions).to.deep.eq(['GPL']);
    expect(discovered.unknown).to.eq(0);
    const tests = summary.licensed.facets.tests;
    expect(tests.files).to.eq(1);
    const declared = tests.declared;
    expect(declared).to.deep.eq(['MIT']);
    expect(!!tests.discovered.expressions).to.be.false;
    expect(tests.discovered.unknown).to.eq(0);
  });
  
  it('summarizes in facet order ', () => {
    const harvested = buildOutput([
      buildPackageFile('package.json', 'MIT', []),
      buildFile('LICENSE.json', 'GPL', [])
    ]);
    const facets = { tests: ['*.json'], dev: ['*.json'] };
    const summarizer = Summarizer();
    const coordinates = 'npm/npmjs/-/test/1.0';
    const summary = summarizer.summarize(coordinates, harvested, facets);
    const core = summary.licensed.facets.core;
    expect(core.files).to.eq(0);
    const dev = summary.licensed.facets.dev;
    expect(dev.files).to.eq(0);
    const discovered = dev.discovered;
    expect(!!discovered.expression).to.be.false;
    expect(discovered.unknown).to.eq(0);
    const tests = summary.licensed.facets.tests;
    expect(tests.files).to.eq(2);
    const declared = tests.declared;
    expect(declared).to.deep.eq(['MIT']);
    expect(tests.discovered.expressions).to.deep.eq(['GPL']);
    expect(tests.discovered.unknown).to.eq(0);
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
