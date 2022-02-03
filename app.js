// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const rateLimitRedisStore = require('rate-limit-redis')
const redis = require('redis')

const helmet = require('helmet')
const serializeError = require('serialize-error')
const requestId = require('request-id/express')
const passport = require('passport')
const swaggerUi = require('swagger-ui-express')
const loggerFactory = require('./providers/logging/logger')
const routesVersioning = require('express-routes-versioning')()
const v1 = '1.0.0'

function createApp(config) {
  const initializers = []

  const logger = loggerFactory(config.logging.logger())
  process.on('unhandledRejection', exception => logger.error('unhandledRejection', exception))

  config.auth.service.permissionsSetup()

  const summaryService = require('./business/summarizer')(config.summary)

  const harvestStore = config.harvest.store()
  initializers.push(async () => harvestStore.initialize())
  const harvestService = config.harvest.service()
  const harvestRoute = require('./routes/harvest')(harvestService, harvestStore, summaryService)

  const aggregatorService = require('./business/aggregator')(config.aggregator)

  const curationStore = config.curation.store()
  initializers.push(async () => curationStore.initialize())

  const definitionStore = config.definition.store()
  initializers.push(async () => definitionStore.initialize())

  const attachmentStore = config.attachment.store()
  initializers.push(async () => attachmentStore.initialize())

  const searchService = config.search.service()
  initializers.push(async () => searchService.initialize())

  const cachingService = config.caching.service()
  initializers.push(async () => cachingService.initialize())

  const curationService = config.curation.service(null, curationStore, config.endpoints, cachingService, harvestStore)

  const curationQueue = config.curation.queue()
  initializers.push(async () => curationQueue.initialize())

  const harvestQueue = config.harvest.queue()
  initializers.push(async () => harvestQueue.initialize())

  const definitionService = require('./business/definitionService')(
    harvestStore,
    harvestService,
    summaryService,
    aggregatorService,
    curationService,
    definitionStore,
    searchService,
    cachingService
  )
  // Circular dependency. Reach in and set the curationService's definitionService. Sigh.
  curationService.definitionService = definitionService

  const curationsRoute = require('./routes/curations')(curationService, logger)
  const definitionsRoute = require('./routes/definitions')(definitionService)
  const definitionsRouteV1 = require('./routes/definitions-1.0.0')(definitionService)

  const suggestionService = require('./business/suggestionService')(definitionService)
  const suggestionsRoute = require('./routes/suggestions')(suggestionService)

  const noticeService = require('./business/noticeService')(definitionService, attachmentStore)
  const noticesRoute = require('./routes/notices')(noticeService)

  const statsService = require('./business/statsService')(definitionService, searchService, cachingService)
  const statsRoute = require('./routes/stats')(statsService)

  const statusService = require('./business/statusService')(config.insights, cachingService)
  const statusRoute = require('./routes/status')(statusService)

  const attachmentsRoute = require('./routes/attachments')(attachmentStore)

  const githubSecret = config.webhook.githubSecret
  const crawlerSecret = config.webhook.crawlerSecret
  const webhookRoute = require('./routes/webhook')(
    curationService,
    definitionService,
    logger,
    githubSecret,
    crawlerSecret
  )

  const app = express()
  app.use(cors())
  app.options('*', cors())
  app.use(cookieParser())
  app.use(helmet())
  app.use(requestId())
  app.use('/schemas', express.static('./schemas'))

  app.use(morgan('dev'))

  const swaggerOptions = { swaggerUrl: `${config.endpoints.service}/schemas/swagger.yaml` }
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions))
  app.use('/webhook', bodyParser.raw({ limit: '10mb', type: '*/*' }), webhookRoute)

  // OAuth app initialization; skip if not configured (middleware can cope)
  const auth = config.auth.service.route(null, config.endpoints)
  if (auth.usePassport()) {
    passport.use(auth.getStrategy())
    app.use(passport.initialize())
  }
  app.use('/auth', auth.router)
  app.use(config.auth.service.middleware())

  app.set('trust-proxy', true)

  // If Redis is configured for caching, connect to it
  const client = config.caching.caching_redis_service ?
    redis.createClient(
      6380,
      config.caching.caching_redis_service,
      {
        auth_pass: config.caching.caching_redis_api_key,
        tls: { servername: config.caching_redis_service }
      }
    ) :
    undefined

  // rate-limit the remaining routes
  const apiLimiter = config.caching.caching_redis_service ?
    rateLimit({
      store: new rateLimitRedisStore({
        client: client,
        prefix: 'api'
      }),
      windowMs: config.limits.windowSeconds * 1000,
      max: config.limits.max
    }) :
    rateLimit({
      windowMs: config.limits.windowSeconds * 1000,
      max: config.limits.max
    })

  app.use(apiLimiter)

  // Use a (potentially lower) different API limit
  // for batch API request
  // for now, these include
  // * POST /definitions
  // * POST /curations
  // * POST /notices
  const batchApiLimiter = config.caching.caching_redis_service ?
    rateLimit({
      store: new rateLimitRedisStore({
        client: client,
        prefix: 'batch-api'
      }),
      windowMs: config.limits.batchWindowSeconds * 1000,
      max: config.limits.batchMax
    }) :
    rateLimit({
      windowMs: config.limits.batchWindowSeconds * 1000,
      max: config.limits.batchMax
    })


  app.post('/definitions', batchApiLimiter)
  app.post('/curations', batchApiLimiter)
  app.post('/notices', batchApiLimiter)

  app.use(require('./middleware/querystring'))

  app.use('/', require('./routes/index'))
  app.use('/origins/github', require('./routes/originGitHub')())
  app.use('/origins/crate', require('./routes/originCrate')())
  app.use('/origins/pod', require('./routes/originPod')())
  app.use('/origins/npm', require('./routes/originNpm')())
  app.use('/origins/maven', require('./routes/originMaven')())
  app.use('/origins/mavenGoogle', require('./routes/originMavenGoogle')())
  app.use('/origins/nuget', require('./routes/originNuget')())
  app.use('/origins/composer', require('./routes/originComposer')())
  app.use('/origins/pypi', require('./routes/originPyPi')())
  app.use('/origins/rubygems', require('./routes/originRubyGems')())
  app.use('/origins/deb', require('./routes/originDeb')())
  app.use('/origins/gitlab', require('./routes/originGitLab')())
  app.use('/origins/go', require('./routes/originGo')())
  app.use('/harvest', harvestRoute)
  app.use(bodyParser.json())
  app.use('/curations', curationsRoute)
  app.use('/definitions', routesVersioning({ [v1]: definitionsRouteV1 }, definitionsRoute))
  app.use('/notices', noticesRoute)
  app.use('/attachments', attachmentsRoute)
  app.use('/suggestions', suggestionsRoute)
  app.use('/stats', statsRoute)
  app.use('/status', statusRoute)

  // catch 404 and forward to error handler
  const requestHandler = (req, res, next) => {
    logger.info('Error when handling a request', { rawUrl: req._parsedUrl._raw, baseUrl: req.baseUrl, originalUrl: req.originalUrl, params: req.params, route: req.route, url: req.url })
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
        // Commenting out because I believe this is broken
        // if (searchService.constructor.name === 'MemorySearch') await definitionService.reload('definitions')
        logger.info('Service initialized', { buildNumber: process.env.BUILD_NUMBER })

        // kick off the queue processors
        require('./providers/curation/process')(curationQueue, curationService, logger)
        require('./providers/harvest/process')(harvestQueue, definitionService, logger)

        // Signal system is up and ok (no error)
        callback()
      },
      error => {
        logger.error('Service initialization error', error)
        callback(error)
      }
    )
  }

  // error handler
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error)

    // Don't log Azure robot liveness checks
    // https://feedback.azure.com/forums/169385-web-apps/suggestions/32120617-document-healthcheck-url-requirement-for-custom-co
    if (!(request && request.url && request.url.includes('robots933456.txt')))
      logger.error('SvcRequestFailure: ' + request.url, error)

    // set locals, only providing error in development
    response.locals.message = error.message
    response.locals.error = request.app.get('env') === 'development' ? error : {}
    const status = typeof error.status === 'number' ? error.status : 500
    // return the error
    response
      .status(status)
      .type('application/json')
      .send({
        error: {
          code: status.toString(),
          message: 'An error has occurred',
          innererror: serializeError(response.locals.error)
        }
      })
  })

  return app
}

module.exports = createApp
