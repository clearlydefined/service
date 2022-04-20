// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const summarizer = require('../../providers/summary/reuse')()

describe('FsfeReuseSummarizer', () => {

  it('should include populate all available attributes', () => {
    const files = [
      { fileName: 'README.md', licenseConcluded: 'MIT', licenseInfoFile: 'NOASSERTION', fileCopyrightText: 'Somebody', checksumSha1: '42' },
      { fileName: 'SECURITY.md', licenseConcluded: 'NOASSERTION', licenseInfoFile: 'Apache-2.0', fileCopyrightText: 'Somebody else', checksumSha1: '23' }
    ]
    const licenses = ['MIT', 'Apache-2.0']
    const data = setup(files, licenses)
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'README.md', license: 'MIT', hashes: { sha1: '42' }, attributions: ['Somebody'] },
        { path: 'SECURITY.md', license: 'Apache-2.0', hashes: { sha1: '23' }, attributions: ['Somebody else'] },
        { path: 'LICENSES/MIT.txt', license: 'MIT', natures: ['license'] },
        { path: 'LICENSES/Apache-2.0.txt', license: 'Apache-2.0', natures: ['license'] },
      ],
      licensed: { declared: 'MIT AND Apache-2.0' }
    })
  })

  it('should ignore missing or irrelevant attributes', () => {
    const files = [
      { fileName: 'README.md', licenseConcluded: 'MIT', fileCopyrightText: 'Somebody', checksumSha1: '42' },
      { fileName: 'SECURITY.md', licenseConcluded: 'NOASSERTION', licenseInfoFile: 'Apache-2.0', fileCopyrightText: 'NONE', checksumSha1: '23' }
    ]
    const licenses = ['MIT', 'Apache-2.0']
    const data = setup(files, licenses)
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'README.md', license: 'MIT', hashes: { sha1: '42' }, attributions: ['Somebody'] },
        { path: 'SECURITY.md', license: 'Apache-2.0', hashes: { sha1: '23' } },
        { path: 'LICENSES/MIT.txt', license: 'MIT', natures: ['license'] },
        { path: 'LICENSES/Apache-2.0.txt', license: 'Apache-2.0', natures: ['license'] },
      ],
      licensed: { declared: 'MIT AND Apache-2.0' }
    })
  })

  it('should ignore missing license information', () => {
    const files = [
      { fileName: 'README.md', licenseConcluded: 'MIT', licenseInfoFile: 'NOASSERTION', fileCopyrightText: 'Somebody', checksumSha1: '42' },
      { fileName: 'SECURITY.md', licenseConcluded: 'NOASSERTION', fileCopyrightText: 'NONE', checksumSha1: '23' }
    ]
    const licenses = ['MIT']
    const data = setup(files, licenses)
    const result = summarizer.summarize(null, data)
    assert.deepEqual(result, {
      files: [
        { path: 'README.md', license: 'MIT', hashes: { sha1: '42' }, attributions: ['Somebody'] },
        { path: 'LICENSES/MIT.txt', license: 'MIT', natures: ['license'] }
      ],
      licensed: { declared: 'MIT' }
    })
  })

  it('should handle no files found', () => {
    const data = setup([], [])
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

function setup(files, licenses) {
  const matchedFiles = files.map(file => {
    return {
      'FileName': file.fileName,
      'LicenseConcluded': file.licenseConcluded,
      'LicenseInfoInFile': file.licenseInfoFile,
      'FileCopyrightText': file.fileCopyrightText,
      'FileChecksumSHA1': file.checksumSha1
    }
  })
  const matchedLicenses = licenses.map(license => {
    return {
      'filePath': ('LICENSES/' + license + '.txt'),
      'spdxId': license
    }
  })
  return { reuse: { metadata: { 'DocumentName': 'ospo-reuse', 'CreatorTool': 'reuse-0.13.0' }, files: matchedFiles, licenses: matchedLicenses } }
}
