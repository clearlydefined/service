// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const { expect } = require('chai')
const cdn = require('../../../providers/caching/cdn')

const testIntervalMs = 200

describe('flush CDN tagged items', () => {
  let lastOptions = {}
  let requestCount = 0
  let cdnService = cdn({ intervalMs: testIntervalMs })
  cdnService.doRequest = requestOptions => {
    lastOptions = requestOptions
    requestCount++
  }
  cdnService.initialize()

  it('will ignore malformed tags', () => {
    cdnService.queue('not valid')
    cdnService.queue('')
    cdnService.queue(' ')
    assert.equal(Object.keys(cdnService._queue).length, 0)
  })
  it('passing the watermark, will flush once', async () => {
    requestCount = 0
    for (let idx = 101; idx <= 130; idx++) {
      cdnService.queue(idx)
    }
    assert.equal(requestCount, 1, 'should call once')
    let bodyObject = JSON.parse(lastOptions.body)
    for (let idx = 101; idx < 130; idx++) {
      expect(bodyObject.tags).to.contain(idx.toString())
    }
  })

  cdnService.uninitialize()

})
