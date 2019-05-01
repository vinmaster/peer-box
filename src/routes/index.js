const express = require('express');
const RateLimit = require('express-rate-limit');
const Sentry = require('@sentry/node');

const Helper = require(`${process.cwd()}/src/lib/helper`);
const Logger = require(`${process.cwd()}/src/lib/logger`);
const Pages = require(`${process.cwd()}/src/routes/pages`);
const router = express.Router();
const limiter = new RateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Limit requests per window
  delayMs: 0,
  skip: Helper.skipReq,
});

router.use(limiter);

// HTML routes
router.get('/', Helper.asyncWrap(Pages.index));
router.get('/:id', Helper.asyncWrap(Pages.room));

// API routes
const apiRouter = express.Router();
router.use('/api', apiRouter);

// Create 404 Not Found for next middleware
apiRouter.use((req, res, next) => {
  next(Helper.createError('Not Found', 404));
});

// Final error middleware
apiRouter.use((err, req, res, _next) => {
  const {
    status, message, info, error,
  } = Helper.digestError(err);
  // Logger.error(error);
  Logger.error(`${error.message}\n${error.stack}`);
  Sentry.captureException(err);

  res.status(status).json({
    status,
    error: {
      message,
      info,
    },
    payload: null,
  });
});

router.use((req, res, next) => {
  next(Helper.createError('Not Found', 404));
});
router.use((err, req, res, _next) => {
  const {
    status, message, error, info,
  } = Helper.digestError(err, { html: true });
  if (status === 404) {
    Logger.error(`${error.message}: ${req.originalUrl}\n${error.stack}`);
  } else {
    Logger.error(`${error.message}\n${error.stack}`);
  }
  Sentry.captureException(err);

  return res.status(status).render('error', {
    title: `${status} - ${message}`,
    status,
    message,
    info,
  });
});

module.exports = router;
