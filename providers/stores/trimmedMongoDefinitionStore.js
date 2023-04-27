// (c) Copyright 2023, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractMongoDefinitionStore = require('./abstractMongoDefinitionStore')
const { clone, range } = require('lodash')
const throat = require('throat')

const CONCURRENCY = 50

class TrimmedMongoDefinitionStore extends AbstractMongoDefinitionStore {
  // eslint-disable-next-line no-unused-vars
  async list(coordinates) {
    //This store does not support list for coordinates
    return null
  }

  // eslint-disable-next-line no-unused-vars
  async get(coordinates) {
    //This store does not support get definition
    return null
  }

  async find(query, continuationToken = '', pageSize) {
    const result = await super.find(query, continuationToken, pageSize)
    result.data.forEach((def) => delete def._id)
    return result
  }

  async store(definition) {
    const definitionDoc = clone(definition)
    definitionDoc._id = this.getId(definition.coordinates)
    delete definitionDoc.files
    return await this.collection.replaceOne({ _id: definitionDoc._id }, definitionDoc, { upsert: true })
  }

  async delete(coordinates) {
    await this.collection.deleteOne({ _id: this.getId(coordinates) })
    return null
  }

  getCoordinatesKey() {
    return '_id'
  }

  async queryStats(type = 'total', withLicenseBreakdown = true) {
    return this._buildStatsViaQueries(type, withLicenseBreakdown)
  }

  async _buildStatsViaQueries(type, withLicenseBreakdown) {
    const  [totalCount, licensedScores, describedScores, declaredLicenses = [] ] = await Promise.all([
      this._fetchTotal(type), 
      this._buildFrequencyTable(type, 'licensed.score.total', [...range(0, 100, 5), 100]),
      this._buildFrequencyTable(type, 'described.score.total'),
      withLicenseBreakdown ? this._fetchTopFrequencies(type, 'licensed.declared') : Promise.resolve([])
    ])
    return { totalCount, describedScores, licensedScores, declaredLicenses }
  }
  
  async _fetchTotal(type) {
    const pipeline = [
      ...this._matchStage(this._typeFilter(type)),
      { $count: 'total' }
    ]
    const data = await this._aggregate(pipeline)
    return data[0]?.total || 0
  }

  _matchStage(filters) {
    const emptyFilters = Object.keys(filters).length === 0
    return emptyFilters ? [] : [{ $match: filters }]
  }

  _typeFilter(type) {
    return type === 'total' ? {} : { 'coordinates.type': type }
  }

  async _aggregate(pipeline) {
    this.logger.debug(`stat aggregate pipeline: ${JSON.stringify(pipeline)}`)
    const cursor = this.collection.aggregate(pipeline)
    return cursor.toArray()
  }

  async _buildFrequencyTable(type, field, milestones) {
    const intervals = this._buildScoreIntervals(milestones)
    const promises = intervals.map(
      throat(CONCURRENCY, async interval => this._fetchCountInRange(type, field, interval)))

    const results = await Promise.all(promises)
    return results.flat()
  }

  _buildScoreIntervals(givenMilestones) {
    const milestones = givenMilestones || [...range(0, 100, 10), 100]
    const intervals = milestones.map((cur, index) => {
      const upperBound = index + 1 < milestones.length ? milestones [index + 1] : cur + 1
      return [cur, upperBound]
    }, [])
    return intervals
  }

  async _fetchCountInRange(type, field, [lowerInclusiveBound = 0, upperExclusiveBound]) {
    const filters =  {
      ...this._typeFilter(type),
      ...this._buildRangeFilter(field, lowerInclusiveBound, upperExclusiveBound)      
    }

    const pipeline = [
      ...this._matchStage(filters),
      { $count: 'count' },
      { $addFields: { value : lowerInclusiveBound } }
    ]
    return this._aggregate(pipeline)
  }

  _buildRangeFilter(field, lowerInclusiveBound, upperExclusiveBound) {
    const rangePredicates = {}
    if (typeof lowerInclusiveBound === 'number') rangePredicates.$gte = lowerInclusiveBound
    if (typeof upperExclusiveBound === 'number') rangePredicates.$lt = upperExclusiveBound
    return (field && Object.keys(rangePredicates).length > 0) ? { [field]: rangePredicates } : {}
  }

  async _fetchTopFrequencies(type, field) {
    const pipeline = [
      ...this._matchStage(this._typeFilter(type)),
      ...this._buildSortByCountPipeline(field)
    ]
    return this._aggregate(pipeline)
  }

  _buildSortByCountPipeline(groupField, limit = 10) {
    //To be consistent with AzureSearch count default to top 10
    return  [ 
      { $sortByCount: '$' + groupField },
      { $addFields: { value : '$_id' } },
      { $project: { _id: 0 } },
      { $limit: limit }
    ]
  }
}

module.exports = options => new TrimmedMongoDefinitionStore(options)
