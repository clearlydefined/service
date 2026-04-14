// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { createRequire } from 'node:module'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { serializeError } from 'serialize-error'

const _require = createRequire(import.meta.url)
const requestId = _require('request-id/express')

import routesVersioning from 'express-routes-versioning'
import passport from 'passport'
import swaggerUi from 'swagger-ui-express'
import createAggregatorService from './business/aggregator.ts'
import createDefinitionService from './business/definitionService.ts'
import createNoticeService from './business/noticeService.ts'
import createStatsService from './business/statsService.ts'
import createStatusService from './business/statusService.ts'
import createSuggestionService from './business/suggestionService.ts'
import createSummaryService from './business/summarizer.ts'
import createCondaRepoAccess from './lib/condaRepoAccess.ts'
import trySetHeapLoggingAtInterval from './lib/heapLogger.ts'
import { setupApiRateLimiterAfterCachingInit, setupBatchApiRateLimiterAfterCachingInit } from './lib/rateLimit.ts'
import startCurationProcessing from './providers/curation/process.ts'
import startHarvestProcessing from './providers/harvest/process.ts'
import loggerFactory from './providers/logging/logger.ts'
import setupAttachmentsRoute from './routes/attachments.ts'
import setupCurationsRoute from './routes/curations.ts'
import setupDefinitionsRoute from './routes/definitions.ts'
import setupDefinitionsRouteV1 from './routes/definitions-1.0.0.ts'
import setupHarvestRoute from './routes/harvest.ts'
import setupIndexRoute from './routes/index.ts'
import setupNoticesRoute from './routes/notices.ts'
import setupOriginComposer from './routes/originComposer.ts'
import setupOriginConda from './routes/originConda.ts'
import setupOriginCondaforge from './routes/originCondaforge.ts'
import setupOriginCrate from './routes/originCrate.ts'
import setupOriginDeb from './routes/originDeb.ts'
import setupOriginGitHub from './routes/originGitHub.ts'
import setupOriginGitLab from './routes/originGitLab.ts'
import setupOriginGo from './routes/originGo.ts'
import setupOriginGradlePlugin from './routes/originGradlePlugin.ts'
import setupOriginMaven from './routes/originMaven.ts'
import setupOriginMavenGoogle from './routes/originMavenGoogle.ts'
import setupOriginNpm from './routes/originNpm.ts'
import setupOriginNuget from './routes/originNuget.ts'
import setupOriginPod from './routes/originPod.ts'
import setupOriginPyPi from './routes/originPyPi.ts'
import setupOriginRubyGems from './routes/originRubyGems.ts'
import setupStatsRoute from './routes/stats.ts'
import setupStatusRoute from './routes/status.ts'
import setupSuggestionsRoute from './routes/suggestions.ts'
import setupWebhookRoute from './routes/webhook.ts'

const v1 = '1.0.0'

/** @param {import('./bin/config.js').AppConfig} config */
function createApp(config) {
  /** @type {(() => Promise<void>)[]} */
  const initializers = []

  const logger = loggerFactory(config.logging.logger())
  process.on('unhandledRejection', exception => logger.error('unhandledRejection', exception))

  config.auth.service.permissionsSetup()

  const summaryService = createSummaryService(config.summary)

  const harvestStore = config.harvest.store()
  initializers.push(async () => harvestStore.initialize())

  const aggregatorService = createAggregatorService(config.aggregator)

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

  const harvestService = config.harvest.service({ cachingService })
  const harvestThrottler = config.harvest.throttler()
  const harvestRoute = setupHarvestRoute(harvestService, harvestStore, summaryService, harvestThrottler)

  const curationService = config.curation.service(null, curationStore, config.endpoints, cachingService, harvestStore)

  const curationQueue = config.curation.queue()
  initializers.push(async () => curationQueue.initialize())

  const harvestQueue = config.harvest.queue()
  initializers.push(async () => harvestQueue.initialize())

  const recomputeHandler = config.upgrade.service({ queue: config.upgrade.queue })
  initializers.push(async () => recomputeHandler.initialize())

  const definitionService = createDefinitionService(
    harvestStore,
    harvestService,
    summaryService,
    aggregatorService,
    curationService,
    definitionStore,
    searchService,
    cachingService,
    recomputeHandler
  )
  // Circular dependency. Reach in and set the curationService's definitionService. Sigh.
  curationService.definitionService = definitionService

  const curationsRoute = setupCurationsRoute(curationService, logger)
  const definitionsRoute = setupDefinitionsRoute(definitionService)
  const definitionsRouteV1 = setupDefinitionsRouteV1(definitionService)

  const suggestionService = createSuggestionService(definitionService)
  const suggestionsRoute = setupSuggestionsRoute(suggestionService)

  const noticeService = createNoticeService(definitionService, attachmentStore)
  const noticesRoute = setupNoticesRoute(noticeService)

  const statsService = createStatsService(definitionService, searchService, cachingService)
  const statsRoute = setupStatsRoute(statsService)

  const statusService = createStatusService(config.insights, cachingService)
  const statusRoute = setupStatusRoute(statusService)

  const attachmentsRoute = setupAttachmentsRoute(attachmentStore)

  const githubSecret = config.webhook.githubSecret
  const crawlerSecret = config.webhook.crawlerSecret
  const webhookRoute = setupWebhookRoute(curationService, definitionService, logger, githubSecret, crawlerSecret)

  // enable heap stats logging at an interval if configured
  trySetHeapLoggingAtInterval(config, logger)

  const app = express()
  app.use(cors())
  // new express v5 matching syntax: https://expressjs.com/en/guide/migrating-5.html#path-syntax
  app.options('*splat', cors())
  app.use(cookieParser())
  app.use(helmet())
  app.use(requestId())
  app.use('/schemas', express.static('./schemas'))

  app.use(morgan('dev'))

  const swaggerOptions = { swaggerUrl: `${config.endpoints.service}/schemas/swagger.yaml` }
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions))
  app.use('/webhook', bodyParser.raw({ limit: '10mb', type: '*/*' }), webhookRoute)
  app.use(express.json({ limit: '100kb' }))

  // OAuth app initialization; skip if not configured (middleware can cope)
  const auth = config.auth.service.route(null, config.endpoints)
  if (auth.usePassport()) {
    passport.use(auth.getStrategy())
    app.use(passport.initialize())
  }
  app.use('/auth', auth.router)
  app.use(config.auth.service.middleware())

  app.set('trust proxy', true)
  app.use('/', setupIndexRoute(config.buildsha, config.appVersion))

  app.use(setupApiRateLimiterAfterCachingInit(config, cachingService))

  // Use a (potentially lower) different API limit
  // for batch API request
  // for now, these include
  // * POST /definitions
  // * POST /curations
  // * POST /notices
  const batchApiLimiter = setupBatchApiRateLimiterAfterCachingInit(config, cachingService)
  const noticeApiLimiter = setupBatchApiRateLimiterAfterCachingInit(
    {
      // Temporary override of rate limit settings for notices (5x the standard API limits)
      ...config,
      limits: {
        windowSeconds: 300,
        max: 10000,
        batchWindowSeconds: 300,
        batchMax: 1250
      }
    },
    cachingService
  )
  app.post('/definitions', batchApiLimiter)
  app.post('/curations', batchApiLimiter)
  app.post('/notices', noticeApiLimiter)

  app.use('/origins/github', setupOriginGitHub())
  app.use('/origins/crate', setupOriginCrate())
  const repoAccess = createCondaRepoAccess()
  app.use('/origins/condaforge', setupOriginCondaforge(repoAccess))
  app.use('/origins/conda', setupOriginConda(repoAccess))
  app.use('/origins/pod', setupOriginPod())
  app.use('/origins/npm', setupOriginNpm())
  app.use('/origins/maven', setupOriginMaven())
  app.use('/origins/mavenGoogle', setupOriginMavenGoogle())
  app.use('/origins/gradleplugin', setupOriginGradlePlugin())
  app.use('/origins/nuget', setupOriginNuget())
  app.use('/origins/composer', setupOriginComposer())
  app.use('/origins/pypi', setupOriginPyPi())
  app.use('/origins/rubygems', setupOriginRubyGems())
  app.use('/origins/deb', setupOriginDeb())
  app.use('/origins/gitlab', setupOriginGitLab())
  app.use('/origins/go', setupOriginGo())
  app.use('/harvest', harvestRoute)
  app.use('/curations', curationsRoute)
  app.use('/definitions', routesVersioning()({ [v1]: definitionsRouteV1 }, definitionsRoute))
  app.use('/notices', noticesRoute)
  app.use('/attachments', attachmentsRoute)
  app.use('/suggestions', suggestionsRoute)
  app.use('/stats', statsRoute)
  app.use('/status', statusRoute)

  // catch 404 and forward to error handler
  /** @param {import('express').Request} req @param {import('express').Response} _res @param {import('express').NextFunction} next */
  const requestHandler = (req, _res, next) => {
    logger.info('Error when handling a request', {
      rawUrl: req._parsedUrl?._raw,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
      params: req.params,
      route: req.route,
      url: req.url
    })
    const err = /** @type {Error & { status?: number }} */ (new Error('Not Found'))
    err.status = 404
    next(err)
  }
  app.use(requestHandler)

  /** @param {unknown} _app @param {(error?: Error) => void} callback */
  requestHandler.init = async (_app, callback) => {
    Promise.all(initializers.map(init => init())).then(
      async () => {
        // Bit of trick for local hosting. Preload search if using an in-memory search service
        // Commenting out for testing only
        // if (searchService.constructor.name === 'MemorySearch') await definitionService.reload('index')
        logger.info('Service initialized', { appVersion: process.env.APP_VERSION })

        // kick off the queue processors
        startCurationProcessing(curationQueue, curationService, logger)
        startHarvestProcessing(harvestQueue, definitionService, logger)
        recomputeHandler.setupProcessing(definitionService, logger)

        // Signal system is up and ok (no error)
        callback()
      },
      error => {
        logger.error('Service initialization error', error)
        callback(error)
      }
    )
  }
  const appAsUnknown = /** @type {unknown} */ (app)
  /** @type {import('./app.js').App} */
  const appWithInit = /** @type {import('./app.js').App} */ (appAsUnknown)
  appWithInit.init = requestHandler.init

  /** @param {Error & {status?: number}} error @param {import('express').Request} request @param {import('express').Response} response @param {import('express').NextFunction} next */
  const errorHandler = (error, request, response, next) => {
    if (response.headersSent) {
      next(error)
    } else {
      // Don't log Azure robot liveness checks
      // https://feedback.azure.com/forums/169385-web-apps/suggestions/32120617-document-healthcheck-url-requirement-for-custom-co
      if (!request?.url?.includes('robots933456.txt')) {
        logger.error(`SvcRequestFailure: ${request.url}`, error)
      }

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
    }
  }
  app.use(errorHandler)

  return appWithInit
}

export default createApp
