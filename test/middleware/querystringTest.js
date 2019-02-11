// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const middleware = require('../../middleware/querystring')

describe('querystring middleware', () => {
  it('normalizes bools', () => {
    const data = new Map([
      ['false', false],
      ['true', true],
      ['', ''],
      [undefined, undefined],
      ['0', 0],
      ['70', 70],
      ['35.5', 35.5],
      ['npm', 'npm']
    ])

    data.forEach((expected, input) => {
      const request = { query: { key: input } }
      middleware(request, null, () => {
        expect(request.query.key).to.eq(expected)
      })
    })
  })
})
