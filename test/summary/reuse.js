// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../providers/summary/reuse')()

describe('FsfeReuseSummarizer', () => {

  it('should include populate all available attributes', () => {
    const data = setup([{ fileName: 'README.md', licenseConcluded: 'MIT', licenseInfoFile: 'NOASSERTION', fileCopyrightText: 'Somebody', checksumSha1: '42' }, { fileName: 'SECURITY.md', licenseConcluded: 'NOASSERTION', licenseInfoFile: 'Apache-2.0', fileCopyrightText: 'Somebody else', checksumSha1: '23' }])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'README.md', license: 'MIT', hashes: { sha1: '42' }, attributions: ['Somebody'] },
        { path: 'SECURITY.md', license: 'Apache-2.0', hashes: { sha1: '23' }, attributions: ['Somebody else'] }
      ]
    })
  })

  it('should ignore missing or irrelevant attributes', () => {
    const data = setup([{ fileName: 'README.md', licenseConcluded: 'MIT', fileCopyrightText: 'Somebody', checksumSha1: '42' }, { fileName: 'SECURITY.md', licenseConcluded: 'NOASSERTION', licenseInfoFile: 'Apache-2.0', fileCopyrightText: 'NONE', checksumSha1: '23' }])
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'README.md', license: 'MIT', hashes: { sha1: '42' }, attributions: ['Somebody'] },
        { path: 'SECURITY.md', license: 'Apache-2.0', hashes: { sha1: '23' } }
      ]
    })
  })

  it('should handle no files found', () => {
    const data = setup([])
    data.reuse.files = null
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {})
  })

  it('should throw an error for invalid data', () => {
    try {
      summarizer.summarize(null, {})
      assert.equal(true, false)
    } catch (error) {
      assert.equal(error.message, 'Invalid REUSE data')
    }
  })
})

function setup(files) {
  const matched_files = files.map(file => {
    return {
      'FileName': file.fileName,
      'LicenseConcluded': file.licenseConcluded,
      'LicenseInfoInFile': file.licenseInfoFile,
      'FileCopyrightText': file.fileCopyrightText,
      'FileChecksumSHA1': file.checksumSha1
    }
  })
  return { reuse: { metadata: { 'DocumentName': 'ospo-reuse', 'CreatorTool': 'reuse-0.13.0' }, files: matched_files } }
}
