// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const serializeError = require('serialize-error');
const requestId = require('request-id/express');
const basicAuth = require('express-basic-auth');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');
const swaggerDoc = yaml.safeLoad(fs.readFileSync('./routes/swagger.yaml'));
const config = require('./lib/config');
const configMiddleware = require('./middleware/config');

const index = require('./routes/index');

const summaryService = require('./business/summarizer')(config.summary);

const harvestStoreProvider = config.harvest.store.provider;
const harvestStore = require(`./providers/harvest/${harvestStoreProvider}`)(config.harvest.store[harvestStoreProvider], summaryService);
const harvesterProvider = config.harvest.harvester.provider;
const harvester = require(`./providers/harvest/${harvesterProvider}`)(config.harvest.harvester[harvesterProvider]);
const harvest = require('./routes/harvest')(harvester, harvestStore, summaryService);

const aggregatorService = require('./business/aggregator')(config.aggregator);

const curationProvider = config.curation.store.provider;
const curationService = require(`./providers/curation/${curationProvider}`)(config.curation.store[curationProvider]);
const curations = require('./routes/curations')(curationService);

const packages = require('./routes/packages')(harvestStore, summaryService, aggregatorService, curationService);

const appLogger = console; // @todo add real logger
const webhook = require('./routes/webhook')(curationService, appLogger);

const app = express();
app.use(cors());
app.options('*', cors());
app.use(helmet());
app.use(requestId());

app.use(logger('dev'));
app.use(configMiddleware);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use(bodyParser.json());
app.use('/webhook', webhook);
app.use(basicAuth({
  users: {
    'token': config.auth.apiToken,
    'clearly': config.auth.password
  }
}));

app.use('/', index);
app.use('/harvest', harvest);
app.use('/curations', curations);
app.use('/packages', packages);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // return the error
  res.status(err.status || 500)
    .type('application/json')
    .send({
      error: {
        code: err.status ? err.status.toString() : 'Unknown',
        message: err.message,
        innererror: serializeError(res.locals.error)
      }
    });
});

module.exports = app;
