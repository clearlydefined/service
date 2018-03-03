// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const badgesRoutes = require('../../routes/badges')

describe('Badge Route', () => {
  it('Test 0 badge', async () => {
    const request = {
      params: {
        type: 'git',
        provider: 'github',
        namespace: 'expressjs',
        name: 'express',
        revision: '351396f971280ab79faddcf9782ea50f4e88358d'
      }
    }
    const service = {
      get: () => request
    }
    const result = await badgesRoutes.getComponentBadgeLink(service, request)
    expect(result).to.eq('https://img.shields.io/badge/ClearlyDefined-0-red.svg')
  })
})
