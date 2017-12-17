// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const express = require('express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const serializeError = require('serialize-error');
const requestId = require('request-id/express');
const basicAuth = require('express-basic-auth')

const config = require('./lib/config');
const configMiddleware = require('./middleware/config');

const index = require('./routes/index');

const harvestProvider = config.harvest.store.provider;
const harvestService = require(`./providers/harvest/${harvestProvider}`)(config.harvest.store[harvestProvider]);
const harvest = require('./routes/harvest')(harvestService);

const summaryService = require('./business/summarizer')(config.summary);

const aggregatorService = require('./business/aggregator')(config.aggregator);

const curationProvider = config.curation.store.provider;
const curationService = require(`./providers/curation/${curationProvider}`)(config.curation.store[curationProvider]);
const curations = require('./routes/curations')(curationService);

const packages = require('./routes/packages')(harvestService, summaryService, aggregatorService, curationService);

const app = express();
app.use(helmet());
app.use(requestId());

app.use(logger('dev'));
app.use(configMiddleware);
app.use(basicAuth({
  users: {
    'token': config.auth.apiToken
  }
}));

app.use('/', index);
app.use('/harvest', harvest);
app.use(bodyParser.json());
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
