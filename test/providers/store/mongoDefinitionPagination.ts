import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
// @ts-nocheck
// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fsPromise from 'node:fs/promises'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import lodash from 'lodash'
import { MongoMemoryServer } from 'mongodb-memory-server'
import EntityCoordinates from '../../../lib/entityCoordinates.js'

const { uniq } = lodash

// @ts-expect-error - Node 24 runs .ts as ESM but TypeScript infers CJS
const __dirname = dirname(fileURLToPath(import.meta.url))

const dbOptions = {
  dbName: 'clearlydefined',
  logger: {
    debug: () => {},
    info: () => {}
  }
}

const shouldPaginateSearchCorrectly = () => {
  describe('Mongo Definition Store: search pagination', () => {
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
      const defs = await loadDefinitions()
      mongoStore = await this.createStore(options, defs)
    })

    after('cleanup database', async function () {
      this.timeout(10000)
      if (mongoStore) {
        await mongoStore.collection.drop()
        await mongoStore.close()
      }

      await mongoServer.stop()
    })

    it('should fetch records without sort continuously', async () => {
      const expected = [
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0',
        'maven/mavencentral/io.jenetics/jenetics/7.1.1',
        'maven/mavencentral/io.quarkiverse.cxf/quarkus-cxf/1.5.4',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5'
      ]
      const query = {}
      const defs = await fetchAll(mongoStore, query, 5)
      assert.strictEqual(defs.length, 12)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should sort ascending on releaseDate and find 1 page of records', async () => {
      const expected = ['maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5']
      const query = {
        sort: 'releaseDate',
        sortDesc: false
      }
      const defs = await fetchUpToNTimes(mongoStore, query, 1)
      assert.strictEqual(defs.length, 1)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should sort ascending on releaseDate and handle null and non null values in continuation', async () => {
      const expected = [
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5',
        'maven/mavencentral/org.flywaydb/flyway-maven-plugin/5.0.7',
        'npm/npmjs/@sinclair/typebox/0.24.45',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-beta2',
        'pypi/pypi/-/backports.ssl_match_hostname/3.5.0.1'
      ]

      const query = {
        sort: 'releaseDate',
        sortDesc: false
      }
      const defs = await fetchAll(mongoStore, query)
      assert.ok(!defs[0].described.releaseDate)
      assert.ok(defs[3].described.releaseDate)

      assert.strictEqual(defs.length, 12)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should sort descending on releaseDate and handle null and non null values in continuation', async () => {
      const query = {
        sort: 'releaseDate',
        sortDesc: true
      }
      const defs = await fetchAll(mongoStore, query)
      assert.strictEqual(defs.length, 12)
      verifyUniqueCoordinates(defs)
    })

    it('should sort ascending on license and handle null and non null values in continuation ', async () => {
      const expected = [
        'npm/npmjs/@sinclair/typebox/0.24.45',
        'maven/mavencentral/io.jenetics/jenetics/7.1.1',
        'maven/mavencentral/io.quarkiverse.cxf/quarkus-cxf/1.5.4',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5',
        'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-beta2'
      ]

      const query = {
        sort: 'license',
        sortDesc: false
      }
      const defs = await fetchAll(mongoStore, query)
      assert.ok(!defs[0].described.releaseDate)
      assert.ok(defs[1].described.releaseDate)
      assert.strictEqual(defs.length, 12)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should sort descending on license and handle null and non null values in continuation ', async () => {
      const query = {
        sort: 'license',
        sortDesc: true
      }
      const defs = await fetchAll(mongoStore, query)
      assert.strictEqual(defs.length, 12)
      verifyUniqueCoordinates(defs)
    })

    it('should filter and sort ascending on multiple keys and handle null and non null namespace in continuation', async () => {
      const expected = [
        'npm/npmjs/-/angular/1.6.9',
        'npm/npmjs/-/redie/0.3.0',
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0',
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca'
      ]

      const query = {
        license: 'MIT',
        sort: 'namespace',
        sortDesc: false
      }
      const defs = await fetchAll(mongoStore, query)
      assert.ok(!defs[0].coordinates.namespace)
      assert.ok(defs[2].coordinates.namespace)
      assert.strictEqual(defs.length, 4)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should filter and sort descending on multiple keys in continuation', async () => {
      const expected = [
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0',
        'npm/npmjs/-/redie/0.3.0',
        'npm/npmjs/-/angular/1.6.9'
      ]

      const query = {
        license: 'MIT',
        sort: 'namespace',
        sortDesc: true
      }
      const defs = await fetchAll(mongoStore, query)
      assert.strictEqual(defs.length, 4)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should filter and sort on numerical scores and fetch continuously', async () => {
      const expected = [
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0',
        'npm/npmjs/-/angular/1.6.9',
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
        'npm/npmjs/-/redie/0.3.0'
      ]

      const query = {
        license: 'MIT',
        sort: 'toolScore',
        sortDesc: false
      }
      const defs = await fetchAll(mongoStore, query)
      assert.strictEqual(defs.length, 4)
      assert.strictEqual(defs[0].scores.tool, 80)
      assert.strictEqual(defs[1].scores.tool, 84)
      assert.strictEqual(defs[2].scores.tool, 90)
      assert.strictEqual(defs[3].scores.tool, 94)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })

    it('should filter and sort descending on numerical scores and fetch continuously', async () => {
      const expected = [
        'npm/npmjs/-/redie/0.3.0',
        'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
        'npm/npmjs/-/angular/1.6.9',
        'maven/mavencentral/com.azure/azure-storage-blob/12.20.0'
      ]

      const query = {
        license: 'MIT',
        sort: 'toolScore',
        sortDesc: true
      }
      const defs = await fetchAll(mongoStore, query)
      assert.strictEqual(defs.length, 4)
      const coordinates = verifyUniqueCoordinates(defs)
      verifyExpectedCoordinates(coordinates, expected)
    })
  })
}

async function loadDefinitions() {
  const fileName = path.join(__dirname, '../../fixtures/store/definitions-paged-no-files')
  const content = await fsPromise.readFile(fileName)
  return JSON.parse(content.toString())
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

async function fetchAll(mongoStore, query, pageSize) {
  return fetchUpToNTimes(mongoStore, query, Number.MAX_SAFE_INTEGER, pageSize)
}

//Default pageSize set to 1 to verify null value handling
async function fetchUpToNTimes(mongoStore, query, nTimes, pageSize = 1) {
  const allData = []
  const fetchOperation = async params => {
    const { continuationToken, ...query } = params
    const result = await mongoStore.find(query, continuationToken, pageSize)
    allData.push(...result.data)
    return result
  }
  await new ContinousFetch(fetchOperation).fetchUpToNtimes(query, nTimes)
  return allData
}

class ContinousFetch {
  constructor(fetchOperation, delay = 0) {
    this._fetchOperation = fetchOperation
    this._delay = delay
  }

  async fetchBatch(params) {
    const { data, continuationToken } = await this._fetchOperation(params)
    return { continuationToken, count: data.length }
  }

  _delayedFetch(params) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.fetchBatch(params)
          .then(retrieved => resolve(retrieved))
          .catch(error => reject(error))
      }, this._delay)
    })
  }

  async fetchUpToNtimes(params, nTime) {
    let dispatchCounter = 0
    let fetchedCounter = 0
    let retrieved = {}

    while (dispatchCounter < nTime) {
      retrieved = await this._delayedFetch({
        ...params,
        continuationToken: retrieved.continuationToken
      })

      fetchedCounter += retrieved.count
      dispatchCounter++

      if (!retrieved.continuationToken) {
        break
      }
    }
    return fetchedCounter
  }
}

export default shouldPaginateSearchCorrectly
