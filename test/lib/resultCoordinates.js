const { expect } = require('chai')
const ResultCoordinates = require('../../lib/resultCoordinates')

describe('ResultCoordinates', () => {
  it('should create from urn', () => {
    const data = {
      'urn:npm:npmjs:-:JSONStream:revision:1.3.4:tool:clearlydefined:1.1.0': new ResultCoordinates(
        'npm',
        'npmjs',
        '-',
        'JSONStream',
        '1.3.4',
        'clearlydefined',
        '1.1.0'
      ),
      'urn:npm:npmjs:-:JSONStream:revision:1.3.5:tool:clearlydefined:1.1.0': new ResultCoordinates(
        'npm',
        'npmjs',
        null,
        'JSONStream',
        '1.3.5',
        'clearlydefined',
        '1.1.0'
      )
    }

    for (const input of Object.getOwnPropertyNames(data)) {
      const result = ResultCoordinates.fromUrn(input)
      expect(result).to.deep.equal(data[input])
    }
  })
})
