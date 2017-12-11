var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var helmet = require('helmet');
var serializeError = require('serialize-error');
var configMiddleware = require('./middleware/config');

var index = require('./routes/index');
var curations = require('./routes/curations');

var app = express();
app.use(helmet());

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(configMiddleware);

app.use('/', index);
app.use('/curations', curations);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
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

module.exports = app;
