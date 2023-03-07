// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const TrimmedMongoDefinitionStore = require('../../../providers/stores/trimmedMongoDefinitionStore')
const { MongoMemoryServer } = require('mongodb-memory-server')
const fsPromise = require('fs/promises')
const path = require('path')
const { uniq } = require('lodash')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const sinon = require('sinon')
const PagedMongoDefinitionStore = require('../../../providers/stores/mongo')

const dbOptions = {
  dbName: 'clearlydefined',
  collectionName: 'definitions-trimmed',
  logger: {
    debug: () => {},
  },
}

describe('Trimmed Mongo Definition store', () => {
  const mongoServer = new MongoMemoryServer()
  let mongoStore

  before('setup database', async () => {
    await mongoServer.start()
    const uri = await mongoServer.getUri()
    const options = {
      ...dbOptions,
      connectionString: uri,
    }
    mongoStore = TrimmedMongoDefinitionStore(options)
    await mongoStore.initialize()
  })

  after('cleanup database', async () => {
    await mongoStore.close()
    await mongoServer.stop()
  })

  beforeEach('setup collection', async () => {
    mongoStore.collection = mongoStore.db.collection(mongoStore.options.collectionName)
    await setupStore(mongoStore)
  })

  afterEach('cleanup collection', async () => {
    await mongoStore.collection.drop()
  })

  it('should return falsy for get', async function () {
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics/7.1.1')
    const defs = await mongoStore.get(coordinate)
    expect(defs).to.be.not.ok
  })

  it('should return falsy for list', async function () {
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics')
    const defs = await mongoStore.list(coordinate)
    expect(defs).to.be.not.ok
  })

  describe('store', () => {
    it('should call replaceOne with the right arguments', async () => {
      mongoStore.collection.replaceOne = sinon.fake.resolves()
      const definition = createDefinition('npm/npmjs/-/foo/1.0')
      await mongoStore.store(definition)
      expect(mongoStore.collection.replaceOne.callCount).to.eq(1)
      const args = mongoStore.collection.replaceOne.args[0]
      expect(args[0]['_id']).to.eq('npm/npmjs/-/foo/1.0')
      expect(args[1].files).to.be.not.ok
    })

    it('should store the definition', async () => {
      const definition = createDefinition('npm/npmjs/-/foo/1.0')
      await mongoStore.store(definition)
      const defs = await mongoStore.find({ name: 'foo' }, '')
      expect(defs.data.length).to.be.eq(1)
      const coordinates = EntityCoordinates.fromObject(defs.data[0].coordinates)
      expect(coordinates.toString()).to.be.eq('npm/npmjs/-/foo/1.0')
    })
  })

  describe('delete', () => {
    it('should call deleteOne with the right arguments', async () => {
      mongoStore.collection.deleteOne = sinon.fake.resolves()
      await mongoStore.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
      expect(mongoStore.collection.deleteOne.callCount).to.eq(1)
      expect(mongoStore.collection.deleteOne.args[0][0]['_id']).to.eq('npm/npmjs/-/foo/1.0')
    })

    it('should delete the definition', async () => {
      let defs = await mongoStore.find({ name: 'jenetics' }, '')
      expect(defs.data.length).to.be.eq(1)
      await mongoStore.delete(EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics/7.1.1'))
      defs = await mongoStore.find({ name: 'jenetics' }, '')
      expect(defs.data.length).to.be.eq(0)
    })
  })
 
  describe('find', () => {
    it('should call find with right arguments', async () => {
      mongoStore.collection.find = sinon.fake.returns({ toArray: () => Promise.resolve([]) })
      await mongoStore.find({ type: 'npm' })

      const filter = { 'coordinates.type': 'npm' }
      const opts = {
        projection: undefined,
        sort: { _id: 1 },
        limit: 100,
      }
      const findArgs = mongoStore.collection.find.firstCall.args
      expect(findArgs[0]).to.be.deep.equal(filter)
      expect(findArgs[1]).to.be.deep.equal(opts)
    })
    
    it('should find one page of records', async () => {
      const expected = [
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0',
        'maven/mavencentral/io.jenetics/jenetics/7.1.1',
        'maven/mavencentral/io.quarkiverse.cxf/quarkus-cxf/1.5.4',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5'
      ]
      const defs = await mongoStore.find({}, '', 5)
      expect(defs.continuationToken).to.be.ok
      expect(defs.data.length).to.be.equal(5)
      expect(defs.data[0]._id).to.be.not.ok
      const coordinates = verifyUniqueCoordinates(defs.data)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should find all with continuous token', async () => {
      const query = {}
      const defs1 = await mongoStore.find(query, '', 7)
      expect(defs1.continuationToken).to.be.ok
      const defs2 = await mongoStore.find(query, defs1.continuationToken, 7)
      expect(defs2.continuationToken).to.be.not.ok
      const allDefs = [ ...defs1.data, ...defs2.data]
      const coordinates = verifyUniqueCoordinates(allDefs)
      expect(coordinates.length).to.be.equal(12)
    })

    describe('find query', () => {
      it('builds a mongo query', () => {
        const data = new Map([
          [{}, {}],
          [{ type: 'npm' }, { 'coordinates.type': 'npm' }],
          [{ provider: 'npmjs' }, { 'coordinates.provider': 'npmjs' }],
          [{ name: 'package' }, { 'coordinates.name': 'package' }],
          [
            { namespace: '@owner', name: 'package' },
            { 'coordinates.name': 'package', 'coordinates.namespace': '@owner' }
          ],
          [{ license: 'MIT' }, { 'licensed.declared': 'MIT' }],
          [{ releasedAfter: '2018-01-01' }, { 'described.releaseDate': { $gt: '2018-01-01' } }],
          [{ releasedBefore: '2017-12-30' }, { 'described.releaseDate': { $lt: '2017-12-30' } }],
          [{ minLicensedScore: 50 }, { 'licensed.score.total': { $gt: 50 } }],
          [{ maxLicensedScore: 50 }, { 'licensed.score.total': { $lt: 50 } }],
          [{ minDescribedScore: 50 }, { 'described.score.total': { $gt: 50 } }],
          [{ maxDescribedScore: 50 }, { 'described.score.total': { $lt: 50 } }],
          [{ minEffectiveScore: 50 }, { 'scores.effective': { $gt: 50 } }],
          [{ maxEffectiveScore: 50 }, { 'scores.effective': { $lt: 50 } }],
          [{ minToolScore: 50 }, { 'scores.tool': { $gt: 50 } }],
          [{ maxToolScore: 50 }, { 'scores.tool': { $lt: 50 } }]
        ])
        data.forEach((expected, input) => {
          expect(mongoStore.buildQuery(input)).to.deep.equal(expected)
        })
      })

      it('builds a mongo query with continuationToken', () => {
        const parameters = { namespace: '@owner', name: 'package' }
        const sort = {'_id': 1}
        const continuationToken = 'bnBtL25wbWpzLy0vdmVycm9yLzEuMTAuMA'
        const expected = {
          '$and': [{
            'coordinates.name': 'package',
            'coordinates.namespace': '@owner'
          }, {
            '_id': { '$gt': 'npm/npmjs/-/verror/1.10.0' }
          }]  
        }
    
        expect(mongoStore._buildQueryWithPaging(parameters, continuationToken, sort)).to.deep.equal(expected)
      })

      it('builds a mongo sort', () => {
        const data = new Map([
          [{}, { '_id': 1 }],
          [{ sort: 'type' }, { 'coordinates.type': 1, '_id': 1 }],
          [{ sort: 'provider' }, { 'coordinates.provider': 1, '_id': 1 }],
          [{ sort: 'name', sortDesc: true }, { 'coordinates.name': -1, 'coordinates.revision': -1, '_id': 1 }],
          [{ sort: 'namespace' }, { 'coordinates.namespace': 1, 'coordinates.name': 1, 'coordinates.revision': 1, '_id': 1 }],
          [{ sort: 'license', sortDesc: true }, { 'licensed.declared': -1, '_id': 1 }],
          [{ sort: 'releaseDate' }, { 'described.releaseDate': 1, '_id': 1 }],
          [{ sort: 'licensedScore', sortDesc: false }, { 'licensed.score.total': 1, '_id': 1 }],
          [{ sort: 'describedScore' }, { 'described.score.total': 1, '_id': 1 }],
          [{ sort: 'effectiveScore' }, { 'scores.effective': 1, '_id': 1 }],
          [{ sort: 'toolScore' }, { 'scores.tool': 1, '_id': 1 }],
          [{ sort: 'revision' }, { 'coordinates.revision': 1, '_id': 1 }]
        ])
        data.forEach((expected, input) => {
          const result = mongoStore._buildSort(input)
          expect(result).to.deep.equal(expected)
          expect(Object.keys(result)).to.have.ordered.members(Object.keys(expected))
        })
      })

      it('gets a continuationToken', () => {
        const sortClause = {'_id': 1}
        const token = mongoStore._getContinuationToken(5, [
          { _id: 'npm/npmjs/-/a/1.0.0' },
          { _id: 'npm/npmjs/-/b/1.0.0' },
          { _id: 'npm/npmjs/-/c/1.0.0' },
          { _id: 'npm/npmjs/-/d/1.0.0' },
          { _id: 'npm/npmjs/-/e/1.0.0' }
        ], sortClause)
        expect(token).to.eq('bnBtL25wbWpzLy0vZS8xLjAuMA==')
      })

      it('does not get a continuationToken', () => {
        const token = mongoStore._getContinuationToken(5, [
          { _id: 'npm/npmjs/-/a/1.0.0' },
          { _id: 'npm/npmjs/-/b/1.0.0' },
          { _id: 'npm/npmjs/-/c/1.0.0' }
        ])
        expect(token).to.eq('')
      })
    })
  })

  describe('trimmed vs. paged definition', () => {
    let pagedMongoStore
  
    beforeEach('setup database', async () => {
      const uri = await mongoServer.getUri()
      const options = {
        ...dbOptions,
        connectionString: uri,
        collectionName: 'definitions-paged',
      }
      pagedMongoStore = PagedMongoDefinitionStore(options)
      await pagedMongoStore.initialize()
    })
  
    afterEach('cleanup database', async () => {
      await pagedMongoStore.close()
    })

    it('should find definition same as paged definition', async () => {
      const definition = createDefinition('npm/npmjs/-/foo/1.0')
      const query = { name: 'foo' }
      await pagedMongoStore.store(definition)
      const expected = await pagedMongoStore.find(query, '')

      await mongoStore.store(definition)
      const actual = await mongoStore.find(query, '')
      expect(actual).to.be.deep.equal(expected)
    })
  })
})

async function setupStore(mongoStore) {
  const fileName = path.join(__dirname, '../../fixtures/store/definitions-paged-no-files')
  const content = await fsPromise.readFile(fileName)
  const defDump = JSON.parse(content.toString()).map((def) => {
    delete def._mongo
    return def
  })
  await mongoStore.collection.insertMany(defDump)
}

function verifyExpectedCoordinates(allCoordinates, expected) {
  const firstCoordinates = allCoordinates.slice(0, expected.length)
  expect(firstCoordinates).to.be.deep.equal(expected)
}

function verifyUniqueCoordinates(defs) {
  const allCoordinates = defs.map((e) => EntityCoordinates.fromObject(e.coordinates).toString())
  const uniqTokens = uniq(allCoordinates)
  expect(uniqTokens.length).to.be.equal(allCoordinates.length)
  return allCoordinates
}

function createDefinition(coordinates) {
  coordinates = EntityCoordinates.fromString(coordinates)
  return { 
    coordinates,
    described: {},
    licensed: {},
    scores: {},
    _meta: {},
    files: [{ path: '1' }, { path: '2' }]
  }
}