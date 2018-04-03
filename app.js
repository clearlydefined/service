// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
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
const config = require('./lib/config')
const configMiddleware = require('./middleware/config')
const githubMiddleware = require('./middleware/github')

const index = require('./routes/index')

const auth = require('./routes/auth')

const initializers = []
const summaryService = require('./business/summarizer')(config.summary)

const harvestStoreProvider = config.harvest.store.provider
const harvestStore = require(`./providers/stores/${harvestStoreProvider}`)(config.harvest.store[harvestStoreProvider])
const harvesterProvider = config.harvest.harvester.provider
const harvester = require(`./providers/harvest/${harvesterProvider}`)(config.harvest.harvester[harvesterProvider])
const harvest = require('./routes/harvest')(harvester, harvestStore, summaryService)

const aggregatorService = require('./business/aggregator')(config.aggregator)

const curationProvider = config.curation.store.provider
const curationService = require(`./providers/curation/${curationProvider}`)(
  config.curation.store[curationProvider],
  config.endpoints
)
const curations = require('./routes/curations')(curationService)

const definitionStoreProvider = config.definition.store.provider
const definitionStore = require(`./providers/stores/${definitionStoreProvider}`)(
  config.definition.store[definitionStoreProvider]
)
const searchProvider = config.search.provider
const search = require(`./providers/search/${searchProvider}`)(config.search[searchProvider])
initializers.push(() => search.initialize())

const definitionService = require('./business/definitionService')(
  harvestStore,
  summaryService,
  aggregatorService,
  curationService,
  definitionStore,
  search
)
// Circular dependency. Reach in and set the curationService's definitionService. Sigh.
curationService.definitionService = definitionService

require('./business/cacheRefresher')(harvestStore, curationService)

const badges = require('./routes/badges').getRouter(definitionService)
const definitions = require('./routes/definitions')(harvestStore, curationService, definitionService)

const appLogger = console // @todo add real logger
const githubSecret = config.webhook.githubSecret
const crawlerSecret = config.webhook.crawlerSecret
const webhook = require('./routes/webhook')(curationService, definitionService, appLogger, githubSecret, crawlerSecret)

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
app.use(configMiddleware)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))
app.use('/webhook', bodyParser.raw({ limit: '5mb', type: '*/*' }), webhook)

// OAuth app initialization; skip if not configured (middleware can cope)
if (config.auth.github.clientId) {
  passport.use(auth.getStrategy())
  app.use(passport.initialize())
}
app.use('/auth', auth())
app.use(githubMiddleware)

// rate-limit the remaining routes
app.set('trust-proxy', true)
app.use(
  new RateLimit({
    windowMs: config.limits.windowSeconds * 1000,
    max: config.limits.max,
    delayAfter: 0
  })
)

app.use('/', index)
app.use('/origins/github', require('./routes/originGitHub')())
app.use('/origins/npm', require('./routes/originNpm')())
app.use('/origins/maven', require('./routes/originMaven')())
app.use('/harvest', harvest)
app.use(bodyParser.json())
app.use('/curations', curations)
app.use('/badges', badges)
app.use('/definitions', definitions)

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
    () => {
      console.log('Service initialized')
      // call the callback but with no args.  An arg indicates an error.
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

  // return the error
  res
    .status(err.status || 500)
    .type('application/json')
    .send({
      error: {
        code: err.status ? err.status.toString() : 'Unknown',
        message: err.message,
        innererror: serializeError(res.locals.error)
      }
    })
})

module.exports = app
