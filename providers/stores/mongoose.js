// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const mongoose = require('mongoose')
const Schema = mongoose.Schema

// TODO remove this file

class MongooseStore {
  constructor(options) {
    throw new Error('dont use this yet. Not sure we need it')
    this.options = options
  }

  async initialize() {
    super.initialize()
    // mongoose.set('debug', configs.mode === 'development')
    // mongoose.connection.on('connecting', () => logger.info('Connecting to MongoDb...'))
    // mongoose.connection.on('open', () => logger.info('Connection to MongoDb opened'))
    // mongoose.connection.on('connected', () => logger.info('Connected to MongoDb'))
    // mongoose.connection.on('reconnected', () => logger.info('Reconnected to MongoDb'))
    // mongoose.connection.on('disconnected', () => logger.error('Disconnected from MongoDb'))
    mongoose.set('useFindAndModify', false) // See https://github.com/Automattic/mongoose/issues/6922
    mongoose.connection.on('error', error => {
      logger.error(`MongoDb Error ${error}`)
      mongoose.disconnect()
    })

    try {
      await mongoose.connect(
        this.options.connectionString,
        { useNewUrlParser: true }
      )
      this.definitionModel = mongoose.model('Definition', definitionSchema)
    } catch (error) {
      logger.error(`MongoDb first connection attempt failed ${error}`)
    }
  }

  /**
   * List all of the matching components for the given coordinates.
   * Accepts partial coordinates.
   *
   * @param {EntityCoordinates} coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3' ]
   */
  list(coordinates, type = 'entity') {
    return this.definitionModel.find({ coordinates }, 'path')
  }

  /**
   * Get the results of running the tool specified in the coordinates on the entty specified
   * in the coordinates. If a stream is given, write the content directly on the stream and close.
   * Otherwise, return an object that represents the result.
   *
   * @param {ResultCoordinates} coordinates - The coordinates of the result to get
   * @param {WriteStream} [stream] - The stream onto which the output is written, if specified
   * @returns The result object if no stream is specified, otherwise the return value is unspecified.
   */
  async get(coordinates, stream) {
    const result = await this.definitionModel.findOne({ 'coordinates.type': coordinates.type })
    return result.toObject()
  }

  store(coordinates, definition) {
    const path = definition.coordinates.toString()
    definition.coordinates = Object.assign({}, definition.coordinates)
    return this.definitionModel.findOneAndUpdate({ coordinates: definition.coordinates }, definition, { upsert: true })
  }

  delete(coordinates) {
    // const blobName = this._toStoragePathFromCoordinates(coordinates) + '.json'
    // return new Promise((resolve, reject) =>
    //   this.blobService.deleteBlob(this.containerName, blobName, responseOrError(resolve, reject))
    // )
  }
}

module.exports = options => new MongooseStore(options)

const facetSchema = new Schema(
  {
    files: Number,
    attribution: {
      parties: { type: [String], default: undefined },
      unknown: Number
    },
    discovered: {
      expressions: { type: [String], default: undefined },
      unknown: Number
    }
  },
  { minimize: true }
)

const definitionSchema = new Schema(
  {
    schemaVersion: String,
    coordinates: {
      type: { type: String, required: true, enum: ['npm', 'git', 'maven', 'nuget', 'gem', 'pypi', 'sourcearchive'] },
      provider: {
        type: String,
        required: true,
        enum: ['npmjs', 'github', 'mavencentral', 'nuget', 'rubygems', 'pypi']
      },
      namespace: String,
      name: { type: String, required: true },
      revision: { type: String, required: true }
    },
    described: {
      score: { type: Number, min: 0, max: 100 },
      toolScore: { type: Number, min: 0, max: 100 },
      facets: {
        data: { type: [String], default: undefined },
        dev: { type: [String], default: undefined },
        doc: { type: [String], default: undefined },
        examples: { type: [String], default: undefined },
        tests: { type: [String], default: undefined }
      },
      sourceLocation: {},
      projectWebsite: String,
      issueTracker: String,
      releaseDate: String,
      tools: [String]
    },
    licensed: {
      score: { type: Number, min: 0, max: 100 },
      toolScore: { type: Number, min: 0, max: 100 },
      declared: String,
      facets: {
        core: facetSchema,
        data: facetSchema,
        dev: facetSchema,
        doc: facetSchema,
        examples: facetSchema,
        tests: facetSchema
      }
    },
    files: [
      {
        path: String,
        license: String,
        attributions: { type: [String], default: undefined },
        facets: { type: [String], default: undefined },
        token: String
      }
    ]
  },
  {
    toObject: {
      minimize: true,
      versionKey: false,
      transform: (document, object) => {
        delete object._id
        return object
      }
    }
  }
)
definitionSchema.virtual('path').get(() => EntityCoordinates.fromObject(this.coordinates).toString())
