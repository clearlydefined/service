const {expect} = require('chai')
const AttachmentCoordinates = require('../../lib/attachmentCoordinates')

describe('AttachmentCoordinates', () => {
  it('should construct by token', () => {
    const coordinates = new AttachmentCoordinates('thisisatoken')
    expect(coordinates.token).to.eq('thisisatoken')
  })

  it('should construct from string', () => {
    const coordinates1 = AttachmentCoordinates.fromString('/attachment/token1')
    expect(coordinates1.token).to.eq('token1')

    const coordinates2 = AttachmentCoordinates.fromString('attachment/token2')
    expect(coordinates2.token).to.eq('token2')

    const coordinatesnull = AttachmentCoordinates.fromString(null)
    expect(coordinatesnull).to.be.null
  })

  it('should construct from urn', () => {
    const coordinates = AttachmentCoordinates.fromUrn('urn:attachment:tokenfromurn')
    expect(coordinates.token).to.eq('tokenfromurn')

    const coordinatesnull = AttachmentCoordinates.fromUrn(null)
    expect(coordinatesnull).to.be.null
  })

  it('should toString()', () => {
    const coordinates = new AttachmentCoordinates('atoken').toString()
    expect(coordinates).to.eq('attachment/atoken')
  })
})
