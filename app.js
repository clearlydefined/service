// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// TODO consider putting this in for real
process.on('unhandledRejection', (reason, p) => {
  throw reason
})

const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const RateLimit = require('express-rate-limit')
const helmet = require('helmet')
const serializeError = require('serialize-error')
const requestId = require('request-id/express')
const passport = require('passport')
const swaggerUi = require('swagger-ui-express')
const fs = require('fs')
const yaml = require('js-yaml')
const swaggerDoc = yaml.safeLoad(fs.readFileSync('./routes/swagger.yaml'))

function createApp(config) {
  const initializers = []
  const summaryService = require('./business/summarizer')(config.summary)

  const harvestStore = config.harvest.store()
  initializers.push(async () => harvestStore.initialize())
  const harvestService = config.harvest.service()
  const harvest = require('./routes/harvest')(harvestService, harvestStore, summaryService)

  const aggregatorService = require('./business/aggregator')(config.aggregator)

  const curationService = config.curation.service(null, config.endpoints)
  const curations = require('./routes/curations')(curationService)

  const definitionStore = config.definition.store()
  initializers.push(async () => definitionStore.initialize())

  const attachmentStore = config.attachment.store()
  initializers.push(async () => attachmentStore.initialize())

  const searchService = config.search.service()
  initializers.push(async () => searchService.initialize())

  const definitionService = require('./business/definitionService')(
    harvestStore,
    summaryService,
    aggregatorService,
    curationService,
    definitionStore,
    searchService
  )
  // Circular dependency. Reach in and set the curationService's definitionService. Sigh.
  curationService.definitionService = definitionService
  const definitions = require('./routes/definitions')(definitionService)

  const attachments = require('./routes/attachments')(attachmentStore)

  const appLogger = console // @todo add real logger
  const githubSecret = config.webhook.githubSecret
  const crawlerSecret = config.webhook.crawlerSecret
  const webhook = require('./routes/webhook')(
    curationService,
    definitionService,
    appLogger,
    githubSecret,
    crawlerSecret
  )

  const cachingProvider = config.caching.provider
  const caching = require(`./providers/caching/${cachingProvider}`)
  const cachingMiddleware = require('./middleware/caching')

  const app = express()
  app.use(cors())
  app.options('*', cors())
  app.use(cookieParser())
  app.use(helmet())
  app.use(requestId())
  app.use(cachingMiddleware(caching()))

  app.use(logger('dev'))
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))
  app.use('/webhook', bodyParser.raw({ limit: '5mb', type: '*/*' }), webhook)

  // OAuth app initialization; skip if not configured (middleware can cope)
  const authRoute = config.auth.service.route(null, config.endpoints)
  if (authRoute.usePassport) {
    passport.use(authRoute.getStrategy())
    app.use(passport.initialize())
  }
  app.use('/auth', authRoute)
  app.use(config.auth.service.middleware())

  // rate-limit the remaining routes
  app.set('trust-proxy', true)
  app.use(
    new RateLimit({
      windowMs: config.limits.windowSeconds * 1000,
      max: config.limits.max,
      delayAfter: 0
    })
  )

  app.use('/', require('./routes/index'))
  app.use('/origins/github', require('./routes/originGitHub')())
  app.use('/origins/npm', require('./routes/originNpm')())
  app.use('/origins/maven', require('./routes/originMaven')())
  app.use('/origins/nuget', require('./routes/originNuget')())
  app.use('/origins/pypi', require('./routes/originPyPi')())
  app.use('/origins/rubygems', require('./routes/originRubyGems')())
  app.use('/harvest', harvest)
  app.use(bodyParser.json())
  app.use('/curations', curations)
  app.use('/definitions', definitions)
  app.use('/attachments', attachments)

  // catch 404 and forward to error handler
  const requestHandler = (req, res, next) => {
    const err = new Error('Not Found')
    err.status = 404
    next(err)
  }
  app.use(requestHandler)

  // Attach the init code to any request handler
  requestHandler.init = async (app, callback) => {
    Promise.all(initializers.map(init => init())).then(
      async () => {
        // Bit of trick for local hosting. Preload search if using an in-memory search service
        if (searchService.constructor.name === 'MemorySearch') await definitionService.reload('definitions')
        console.log('Service initialized')
        // Signal system is up and ok (no error)
        callback()
      },
      error => {
        console.log(`Service initialization error: ${error.message}`)
        console.dir(error)
        callback(error)
      }
    )
  }

  // error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message
    res.locals.error = req.app.get('env') === 'development' ? err : {}
    const status = typeof err.status === 'number' ? err.status : 500
    const message = typeof err.status === 'number' ? err.message : (err.status || 'Unknown') + '\n' + err.message

    // return the error
    res
      .status(status)
      .type('application/json')
      .send({
        error: {
          code: status.toString(),
          message,
          innererror: serializeError(res.locals.error)
        }
      })
  })

  return app
}

module.exports = createApp
