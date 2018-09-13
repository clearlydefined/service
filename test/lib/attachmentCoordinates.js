// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const AttachmentCoordinates = require('../../lib/attachmentCoordinates')

describe('AttachmentCoordinates', () => {
  it('should construct by id', () => {
    const coordinates = new AttachmentCoordinates('thisisaid')
    expect(coordinates.id).to.eq('thisisaid')
  })

  it('should construct from string', () => {
    const coordinates1 = AttachmentCoordinates.fromString('/attachment/id1')
    expect(coordinates1.id).to.eq('id1')

    const coordinates2 = AttachmentCoordinates.fromString('attachment/id2')
    expect(coordinates2.id).to.eq('id2')

    const coordinatesnull = AttachmentCoordinates.fromString(null)
    expect(coordinatesnull).to.be.null
  })

  it('should construct from urn', () => {
    const coordinates = AttachmentCoordinates.fromUrn('urn:attachment:idfromurn')
    expect(coordinates.id).to.eq('idfromurn')

    const coordinatesnull = AttachmentCoordinates.fromUrn(null)
    expect(coordinatesnull).to.be.null
  })

  it('should toString()', () => {
    const coordinates = new AttachmentCoordinates('aid').toString()
    expect(coordinates).to.eq('attachment/aid')
  })
})
