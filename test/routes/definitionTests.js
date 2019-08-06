const setup = require('../../routes/definitions')
const { expect } = require('chai')

describe('Definition route', () => {
  let definitions
  let mockService = {
    getAll: async () => Promise.resolve([]),
    compute: async () => Promise.resolve([]),
    suggestCoordinates: async () => Promise.resolve([]),
    find: async () => Promise.resolve([])
  }
  beforeEach(() => {
    definitions = setup(mockService, true)
  })
  it('should ignore casing for finding, but patch casing to match request', async () => {
    let request = {
      hostname: 'localhost',
      query: {},
      body: [
        'npm/npmjs/-/testTest/0.0.0',
        'npm/npmjs/-/express/4.17.1',
        'npm/npmjs/-/express/4.17.0'
      ]
    }
    let replied = false
    let response = {
      status: (code) => {
        expect(code).to.eq(200, 'a non-expected code was offered')
      },
      send: (result) => {
        expect(result).to.have.all.keys(request.body)
        replied = true
        return response
      }
    }
    mockService.getAll = async (coordinatesList) => Promise.resolve(coordinatesList.reduce(
      (total, coord) => {
        total[coord.toString().toLowerCase()] = {
          some: 'complex',
          object: true
        }
        return total
      }, {})
    )
    await definitions.listDefinitions(request, response)
    expect(replied).to.be.true
  })
})
