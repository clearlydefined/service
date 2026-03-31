import assert from 'node:assert/strict'
import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test'
// @ts-nocheck
// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fsPromise from 'node:fs/promises'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import lodash from 'lodash'
import { MongoMemoryServer } from 'mongodb-memory-server'
import EntityCoordinates from '../../../lib/entityCoordinates.js'
import PagedMongoDefinitionStore from '../../../providers/stores/mongo.js'
import TrimmedMongoDefinitionStore from '../../../providers/stores/trimmedMongoDefinitionStore.js'

const { uniq } = lodash

// @ts-expect-error - Node 24 runs .ts as ESM but TypeScript infers CJS
const __dirname = dirname(fileURLToPath(import.meta.url))

const dbOptions = {
  dbName: 'clearlydefined',
  collectionName: 'definitions-trimmed',
  logger: {
    debug: () => {},
    info: () => {}
  }
}

describe('Trimmed Mongo Definition store', () => {
  const mongoServer = new MongoMemoryServer()
  let mongoStore

  before('setup database', async function () {
    this.timeout(10000)
    await mongoServer.start()
    const uri = await mongoServer.getUri()
    const options = {
      ...dbOptions,
      connectionString: uri
    }
    mongoStore = TrimmedMongoDefinitionStore(options)
    await mongoStore.initialize()
  })

  after('cleanup database', async function () {
    this.timeout(10000)
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

  it('should return falsy for get', async () => {
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics/7.1.1')
    const defs = await mongoStore.get(coordinate)
    assert.ok(!defs)
  })

  it('should return falsy for list', async () => {
    const coordinate = EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics')
    const defs = await mongoStore.list(coordinate)
    assert.ok(!defs)
  })

  describe('store', () => {
    it('should call replaceOne with the right arguments', async () => {
      mongoStore.collection.replaceOne = sinon.fake.resolves()
      const definition = createDefinition('npm/npmjs/-/foo/1.0')
      await mongoStore.store(definition)
      assert.strictEqual(mongoStore.collection.replaceOne.mock.callCount(), 1)
      const args = mongoStore.collection.replaceOne.args[0]
      assert.strictEqual(args[0]['_id'], 'npm/npmjs/-/foo/1.0')
      assert.ok(!args[1].files)
    })

    it('should store the definition', async () => {
      const definition = createDefinition('npm/npmjs/-/foo/1.0')
      await mongoStore.store(definition)
      const defs = await mongoStore.find({ name: 'foo' }, '')
      assert.strictEqual(defs.data.length, 1)
      const coordinates = EntityCoordinates.fromObject(defs.data[0].coordinates)
      expect(coordinates.toString()).to.be.eq('npm/npmjs/-/foo/1.0')
    })
  })

  describe('delete', () => {
    it('should call deleteOne with the right arguments', async () => {
      mongoStore.collection.deleteOne = sinon.fake.resolves()
      await mongoStore.delete(EntityCoordinates.fromString('npm/npmjs/-/foo/1.0'))
      assert.strictEqual(mongoStore.collection.deleteOne.mock.callCount(), 1)
      assert.strictEqual(mongoStore.collection.deleteOne.mock.calls[0].arguments[0]['_id'], 'npm/npmjs/-/foo/1.0')
    })

    it('should delete the definition', async () => {
      let defs = await mongoStore.find({ name: 'jenetics' }, '')
      assert.strictEqual(defs.data.length, 1)
      await mongoStore.delete(EntityCoordinates.fromString('maven/mavencentral/io.jenetics/jenetics/7.1.1'))
      defs = await mongoStore.find({ name: 'jenetics' }, '')
      assert.strictEqual(defs.data.length, 0)
    })
  })

  describe('find', () => {
    it('should call find with right arguments', async () => {
      mongoStore.collection.find = mock.fn(() => { toArray: () => Promise.resolve([]) })
      await mongoStore.find({ type: 'npm' })

      const filter = { 'coordinates.type': 'npm' }
      const opts = {
        projection: undefined,
        sort: { _id: 1 },
        limit: 100
      }
      const findArgs = mongoStore.collection.find.mock.calls[0].arguments
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
      assert.ok(defs.continuationToken)
      assert.strictEqual(defs.data.length, 5)
      assert.ok(!defs.data[0]._id)
      const coordinates = verifyUniqueCoordinates(defs.data)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should find all with continuous token', async () => {
      const query = {}
      const defs1 = await mongoStore.find(query, '', 7)
      assert.ok(defs1.continuationToken)
      const defs2 = await mongoStore.find(query, defs1.continuationToken, 7)
      assert.ok(!defs2.continuationToken)
      const allDefs = [...defs1.data, ...defs2.data]
      const coordinates = verifyUniqueCoordinates(allDefs)
      assert.strictEqual(coordinates.length, 12)
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
        const sort = { _id: 1 }
        const continuationToken = 'bnBtL25wbWpzLy0vdmVycm9yLzEuMTAuMA'
        const expected = {
          $and: [
            {
              'coordinates.name': 'package',
              'coordinates.namespace': '@owner'
            },
            {
              _id: { $gt: 'npm/npmjs/-/verror/1.10.0' }
            }
          ]
        }

        expect(mongoStore._buildQueryWithPaging(parameters, continuationToken, sort)).to.deep.equal(expected)
      })

      it('builds a mongo sort', () => {
        const data = new Map([
          [{}, { _id: 1 }],
          [{ sort: 'type' }, { 'coordinates.type': 1, _id: 1 }],
          [{ sort: 'provider' }, { 'coordinates.provider': 1, _id: 1 }],
          [
            { sort: 'name', sortDesc: true },
            { 'coordinates.name': -1, 'coordinates.revision': -1, _id: -1 }
          ],
          [
            { sort: 'namespace' },
            { 'coordinates.namespace': 1, 'coordinates.name': 1, 'coordinates.revision': 1, _id: 1 }
          ],
          [
            { sort: 'license', sortDesc: true },
            { 'licensed.declared': -1, _id: -1 }
          ],
          [{ sort: 'releaseDate' }, { 'described.releaseDate': 1, _id: 1 }],
          [
            { sort: 'licensedScore', sortDesc: false },
            { 'licensed.score.total': 1, _id: 1 }
          ],
          [{ sort: 'describedScore' }, { 'described.score.total': 1, _id: 1 }],
          [{ sort: 'effectiveScore' }, { 'scores.effective': 1, _id: 1 }],
          [{ sort: 'toolScore' }, { 'scores.tool': 1, _id: 1 }],
          [{ sort: 'revision' }, { 'coordinates.revision': 1, _id: 1 }]
        ])
        data.forEach((expected, input) => {
          const result = mongoStore._buildSort(input)
          assert.deepStrictEqual(result, expected)
          expect(Object.keys(result)).to.have.ordered.members(Object.keys(expected))
        })
      })

      it('creates the correct Indexes', async () => {
        mongoStore.collection.createIndex = mock.fn()
        await mongoStore._createIndexes()
        assert.strictEqual(mongoStore.collection.createIndex.mock.callCount(), 19)
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[0].arguments[0], { '_meta.updated': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[1].arguments[0], { _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[2].arguments[0], { 'coordinates.type': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[3].arguments[0], { 'coordinates.provider': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[4].arguments[0], {
          'coordinates.name': 1,
          'coordinates.revision': 1,
          _id: 1
        })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[5].arguments[0], {
          'coordinates.namespace': 1,
          'coordinates.name': 1,
          'coordinates.revision': 1,
          _id: 1
        })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[6].arguments[0], { 'coordinates.revision': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[7].arguments[0], { 'licensed.declared': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[8].arguments[0], { 'described.releaseDate': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[9].arguments[0], { 'licensed.score.total': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[10].arguments[0], { 'described.score.total': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[11].arguments[0], { 'scores.effective': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[12].arguments[0], { 'scores.tool': 1, _id: 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[13].arguments[0], { 'coordinates.name': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[14].arguments[0], { 'coordinates.revision': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[15].arguments[0], { 'coordinates.type': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[16].arguments[0], { 'described.releaseDate': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[17].arguments[0], { 'licensed.declared': 1 })
        assert.deepStrictEqual(mongoStore.collection.createIndex.mock.calls[18].arguments[0], { 'scores.effective': 1 })
      })

      it('gets a continuationToken', () => {
        const sortClause = { _id: 1 }
        const token = mongoStore._getContinuationToken(
          5,
          [
            { _id: 'npm/npmjs/-/a/1.0.0' },
            { _id: 'npm/npmjs/-/b/1.0.0' },
            { _id: 'npm/npmjs/-/c/1.0.0' },
            { _id: 'npm/npmjs/-/d/1.0.0' },
            { _id: 'npm/npmjs/-/e/1.0.0' }
          ],
          sortClause
        )
        assert.strictEqual(token, 'bnBtL25wbWpzLy0vZS8xLjAuMA==')
      })

      it('does not get a continuationToken', () => {
        const token = mongoStore._getContinuationToken(5, [
          { _id: 'npm/npmjs/-/a/1.0.0' },
          { _id: 'npm/npmjs/-/b/1.0.0' },
          { _id: 'npm/npmjs/-/c/1.0.0' }
        ])
        assert.strictEqual(token, '')
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
        collectionName: 'definitions-paged'
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
  const defDump = JSON.parse(content.toString()).map(def => {
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
  const allCoordinates = defs.map(e => EntityCoordinates.fromObject(e.coordinates).toString())
  const uniqTokens = uniq(allCoordinates)
  assert.strictEqual(uniqTokens.length, allCoordinates.length)
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
