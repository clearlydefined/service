// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class MongoCurationStore {
  constructor(options) {
    this.options = options
  }

  initialize() {
    return promiseRetry(async retry => {
      try {
        this.client = await MongoClient.connect(
          this.options.connectionString,
          { useNewUrlParser: true }
        )
        this.db = this.client.db(this.options.dbName)
        this.collection = this.db.collection('curations')
      } catch (error) {
        retry(error)
      }
    })
  }

  async updateContribution(contribution) {
    contribution._id = contribution.number
    await this.collection.replaceOne({ _id: contribution._id }, contribution, { upsert: true })
    // explicitly return null rather than the result of replaceOne to hide the implementation
    return null
  }

  async updateCurations(curations) {
    await Promise.all(
      curations.map(
        throat(10, curation => {
          curation._id = this._getCurationId(curation)
          return this.collection.replaceOne({ _id: curation._id }, curation, { upsert: true })
        })
      )
    )
    // explicitly return null rather than the result of replaceOne to hide the implementation
    return null
  }

  _getCurationId(coordinates) {
    if (!coordinates) return ''
    return EntityCoordinates.fromObject(coordinates)
      .toString()
      .toLowerCase()
  }

  /**
   * Get the contribution or curation for the entity at the given coordinates. If no `contribution` is supplied
   * then look up the curation. If a contribution is identified (i.e., is a PR number), get the contribution
   * held in that PR. If the `contribution` is an object, just use that and return it.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation. Must include revision.
   * @param {(number | string | Summary)} [contribution] - The contribution identifier if any. Could be a PR number
   * (as a number or a string), an actual contribution object or null.
   * @returns {Object} The requested curation and corresponding revision identifier (e.g., commit sha) if relevant
   */
  // TODO consider factoring out the contribution === an object case. Not really sure we need that here. Test in the caller
  async get(coordinates, contribution = null) {
    if (!contribution) return this.getCuration(coordinates)
    // if the contribution is an object then we already have the result needed so return it
    if (typeof contribution !== 'number' && typeof contribution !== 'string') return contribution
    return this.getContribution(coordinates, contribution)
  }

  /**
   * Get the identified contribution for the definition at the given coordinates.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation. Must include revision.
   * @param {(number | string)} [contribution] - the contribution (PR) number to consult
   * @returns {Object} The requested contribution
   */
  async getContribution(coordinates, contribution) {
    if (!coordinates.revision) throw new Error('Coordinates must include a revision')
    // TODO call mongo here
  }

  /**
   * Get the current curation (if any) for the definition at the given coordinates.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation. Must include revision.
   * @returns {Object} The requested contribution
   */
  async getCuration(coordinates) {
    if (!coordinates.revision) throw new Error('Coordinates must include a revision')
    // TODO call mongo here
  }

  /**
   * Get the curations for the revisions of the entity at the given coordinates. Revision information
   * in coordinates are ignored. If a PR number is provided, get the curations represented in that PR.
   *
   * @param {EntitySpec} coordinates - The entity for which we are looking for a curation.
   * @param {(number | string} [pr] - The curation identifier if any. Could be a PR number/string.
   * @returns {Object} The requested curations where the revisions property has a property for each
   * curated revision. The returned value will be decorated with a non-enumerable `_origin` property
   * indicating the sha of the commit for the curations if that info is available.
   */
  async getAll(coordinates, pr = null) {
    // Check to see if there is content for the given coordinates
    const path = this._getCurationPath(coordinates)
  }

  async getCurations(number, ref) {
    const prFiles = await this._getPrFiles(number)
    const curationFilenames = prFiles.map(x => x.filename).filter(this._isCurationFile)
    return Promise.all(
      curationFilenames.map(path => this._getContent(ref, path).then(content => new Curation(content, path)))
    )
  }

  /**
   * Given a partial spec, return the list of full spec urls for each curated version of the spec'd components
   * @param {EntityCoordinates} coordinates - the partial coordinates that describe the sort of curation to look for.
   * @returns {[URL]} - Array of URLs describing the available curations
   */
  async list(coordinates) {
    await this._ensureCurations()
    const root = `${this.tempLocation.name}/${this.options.repo}/${this._getSearchRoot(coordinates)}`
    if (!fs.existsSync(root)) return []
    return new Promise((resolve, reject) => {
      const result = []
      readdirp({ root, fileFilter: '*.yaml' })
        .on('data', entry => result.push(...this._handleRepoEntry(entry)))
        .on('end', () => resolve(result))
        .on('error', reject)
    })
  }

  async getChangedDefinitions(number) {
    const files = await this._getPrFiles(number)
    const changedCoordinates = []
    for (let i = 0; i < files.length; ++i) {
      const fileName = files[i].filename.replace(/\.yaml$/, '').replace(/^curations\//, '')
      const coordinates = EntityCoordinates.fromString(fileName)
      const prDefinitions = (await this.getAll(coordinates, number)) || { revisions: [] }
      const masterDefinitions = (await this.getAll(coordinates)) || { revisions: [] }
      const allUnfilteredRevisions = concat(
        Object.keys(prDefinitions.revisions),
        Object.keys(masterDefinitions.revisions)
      )
      const allRevisions = uniq(allUnfilteredRevisions)
      const changedRevisions = allRevisions.filter(
        revision => !isEqual(prDefinitions.revisions[revision], masterDefinitions.revisions[revision])
      )
      changedRevisions.forEach(revision => changedCoordinates.push(`${fileName}/${revision}`))
    }
    return changedCoordinates
  }
}

module.exports = options => new MongoCurationStore(options)
