const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const Sentry = require('@sentry/node');
const path = require('path');

const app = express();
const env = app.get('env');

// Load .env for development before process.env is used
if (env === 'development' || env === 'test') {
  require('dotenv').config(); // eslint-disable-line
}

const Helper = require(`${process.cwd()}/src/lib/helper`);
const Logger = require(`${process.cwd()}/src/lib/logger`);

// Sentry for errors
if (env === 'production') {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  // The error handler must be before any other error middleware
  app.use(Sentry.Handlers.errorHandler());
}

// Morgan
if (env === 'development') {
  app.use(morgan('dev', { skip: Helper.skipReq, stream: Logger.stream }));
} else if (env !== 'test') {
  app.use(morgan('[:date[clf]] ":method :url" :status :response-time ms', { skip: Helper.skipReq, stream: Logger.stream }));
}

// Handle node errors
process.on('unhandledRejection', error => {
  Logger.error(`unhandledRejection ${error.stack}`);
  throw error;
});
process.on('uncaughtException', error => {
  Logger.error(`uncaughtException ${error.stack}`);
  throw error;
});

// Allow CORS
app.use(cors());

// Use helmet for good practice
app.use(helmet());

// parse application/json
app.use(bodyParser.json());
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Set views directory
app.set('views', path.join(__dirname, '/views'));

// Set up public folder
app.use(express.static(`${process.cwd()}/public`));

// Register routes
const routes = require(`${process.cwd()}/src/routes`);
app.use('/', routes);

module.exports = app;
