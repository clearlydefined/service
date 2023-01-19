// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const Store = require('../../../providers/stores/mongo')
const EntityCoordinates = require('../../../lib/entityCoordinates')
const { MongoMemoryServer } = require('mongodb-memory-server')
const fsPromise = require('fs/promises')
const path = require('path')
const { uniq } = require('lodash')

const dbOptions = {
  dbName: 'clearlydefined',
  collectionName: 'definitions-paged',
  logger: {
    debug: () => {}
  }
}

describe('Mongo Definition store: search pagination', () => {
  const mongoServer = new MongoMemoryServer()
  let mongoStore

  before('setup database', async () => {
    await mongoServer.start()
    const uri = await mongoServer.getUri()
    const options = {
      ...dbOptions,
      connectionString: uri
    }
    mongoStore = Store(options)
    await mongoStore.initialize()

    await setupStore(mongoStore)
  })

  after('cleanup database', async () => {
    await mongoStore.collection.drop()
    await mongoStore.close()
    await mongoServer.stop()
  })

  it('should fetch records without sort continuously', async function() {
    //filter: {'_mongo.page': 1}
    //sort: {'_mongo.partitionKey': 1}
    const expected = [
      'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca', 
      'maven/mavencentral/com.azure/azure-storage-blob/12.20.0', 
      'maven/mavencentral/io.jenetics/jenetics/7.1.1',
      'maven/mavencentral/io.quarkiverse.cxf/quarkus-cxf/1.5.4',
      'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5'
    ]
    const query = {}
    const defs = await fetchAll(mongoStore, query, 5)
    expect(defs.length).to.be.equal(12)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should sort ascending on releaseDate and find 1 page of records', async function() {
    //filter: {'_mongo.page': 1}
    //sort: {'described.releaseDate': 1,'_mongo.partitionKey': 1}
    const expected = ['maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5']
    const query = {
      sort: 'releaseDate',
      sortDesc: false
    }
    const defs = await fetchUpToNTimes(mongoStore, query, 1)
    expect(defs.length).to.be.equal(1)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should sort ascending on releaseDate and handle null and non null values in continuation', async function() {
    //filter: {'_mongo.page': 1}
    //sort: {'described.releaseDate': 1, '_mongo.partitionKey': 1}
    const expected = [
      'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5', 
      'maven/mavencentral/org.flywaydb/flyway-maven-plugin/5.0.7', 
      'npm/npmjs/@sinclair/typebox/0.24.45', 
      'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-beta2',
      'pypi/pypi/-/backports.ssl_match_hostname/3.5.0.1']

    const query = {
      sort: 'releaseDate',
      sortDesc: false
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs[0].described.releaseDate).not.to.be.ok
    expect(defs[3].described.releaseDate).to.be.ok

    expect(defs.length).to.be.equal(12)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })
  
  it('should sort descending on releaseDate and handle null and non null values in continuation', async function() {
    const query = {
      sort: 'releaseDate',
      sortDesc: true
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs.length).to.be.equal(12)
    verifyUniqueCoordinates(defs)
  })

  it('should sort ascending on license and handle null and non null values in continuation ', async function() {
    //filter: {'_mongo.page': 1}
    //sort: {'licensed.declared': 1, '_mongo.partitionKey': 1}
    const expected = [
      'npm/npmjs/@sinclair/typebox/0.24.45', 
      'maven/mavencentral/io.jenetics/jenetics/7.1.1', 
      'maven/mavencentral/io.quarkiverse.cxf/quarkus-cxf/1.5.4', 
      'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-alpha5', 
      'maven/mavencentral/org.apache.httpcomponents/httpcore/4.0-beta2']

    const query = {
      sort: 'license',
      sortDesc: false
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs[0].described.releaseDate).not.to.be.ok
    expect(defs[1].described.releaseDate).to.be.ok
    expect(defs.length).to.be.equal(12)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should sort descending on license and handle null and non null values in continuation ', async function() {
    const query = {
      sort: 'license',
      sortDesc: true
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs.length).to.be.equal(12)
    verifyUniqueCoordinates(defs)
  })

  it('should filter and sort ascending on multiple keys and handle null and non null namespace in continuation', async function() {
    //filter: {'licensed.declared': 'MIT', '_mongo.page': 1}
    //sort: {'coordinates.namespace': 1, 'coordinates.name':1, 'coordinates.revision': 1, '_mongo.partitionKey': 1}
    const expected = [
      'npm/npmjs/-/angular/1.6.9', 
      'npm/npmjs/-/redie/0.3.0', 
      'maven/mavencentral/com.azure/azure-storage-blob/12.20.0', 
      'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca']
   
    const query = {
      license: 'MIT',
      sort: 'namespace',
      sortDesc: false
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs[0].coordinates.namespace).not.to.be.ok
    expect(defs[2].coordinates.namespace).to.be.ok
    expect(defs.length).to.be.equal(4)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should filter and sort descending on multiple keys in continuation', async function() {
    //filter: {'licensed.declared': 'MIT', '_mongo.page': 1}
    //sort: {'coordinates.namespace': -1, 'coordinates.name':-1, 'coordinates.revision': -1, '_mongo.partitionKey': 1}
    const expected = [
      'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca',
      'maven/mavencentral/com.azure/azure-storage-blob/12.20.0', 
      'npm/npmjs/-/redie/0.3.0', 
      'npm/npmjs/-/angular/1.6.9']
   
    const query = {
      license: 'MIT',
      sort: 'namespace',
      sortDesc: true
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs.length).to.be.equal(4)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should filter and sort on numerical scores and fetch continuously', async function() {
    //filter: {'licensed.declared': 'MIT', '_mongo.page': 1}
    //sort: {'scores.tool': 1, '_mongo.partitionKey': 1}
    const expected = [
      'maven/mavencentral/com.azure/azure-storage-blob/12.20.0', 
      'npm/npmjs/-/angular/1.6.9', 
      'git/github/microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca', 
      'npm/npmjs/-/redie/0.3.0']
  
    const query = {
      license: 'MIT',
      sort: 'toolScore',
      sortDesc: false
    }
    const defs = await fetchAll(mongoStore, query)
    expect(defs.length).to.be.equal(4)
    expect(defs[0].scores.tool).to.be.equal(80)
    expect(defs[1].scores.tool).to.be.equal(84)
    expect(defs[2].scores.tool).to.be.equal(90)
    expect(defs[3].scores.tool).to.be.equal(94)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

  it('should filter and sort descending on numerical scores and fetch continuously', async function() {
    //filter: {'licensed.declared': 'MIT', '_mongo.page': 1}
    //sort: {'scores.tool': -1, '_mongo.partitionKey': 1}
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
    expect(defs.length).to.be.equal(4)
    const coordinates = verifyUniqueCoordinates(defs)
    verifyExpectedCoordinates(coordinates, expected)
  })

})

async function setupStore(mongoStore) {
  const fileName = path.join(__dirname, '../../fixtures/store/definitions-paged-no-files')
  const content = await fsPromise.readFile(fileName)
  const defDump =  JSON.parse(content.toString())
  await mongoStore.collection.createIndex({ '_mongo.partitionKey': 1 })
  await mongoStore.collection.insertMany(defDump)
}

function verifyExpectedCoordinates(allCoordinates, expected) {
  const firstCoordinates = allCoordinates.slice(0, expected.length)
  expect(firstCoordinates).to.be.deep.equal(expected)
}

function verifyUniqueCoordinates(defs) {
  const allCoordinates = defs.map(e => EntityCoordinates.fromObject(e.coordinates).toString())
  const uniqTokens = uniq(allCoordinates)
  expect(uniqTokens.length).to.be.equal(allCoordinates.length)
  return allCoordinates
}

async function fetchAll(mongoStore, query, pageSize) {
  return fetchUpToNTimes(mongoStore, query, Number.MAX_SAFE_INTEGER, pageSize)
}

//Default pageSize set to 1 to verify null value handling
async function fetchUpToNTimes(mongoStore, query, nTimes, pageSize = 1) {
  const allData = []
  const fetchOperation = async (params) => {
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
    let dispatchCounter = 0, fetchedCounter = 0
    let retrieved = {}

    while (dispatchCounter < nTime) {
      retrieved = await this._delayedFetch({
        ...params,
        continuationToken: retrieved.continuationToken })

      fetchedCounter += retrieved.count
      dispatchCounter ++

      if (!retrieved.continuationToken) break
    }
    return fetchedCounter
  }
}
