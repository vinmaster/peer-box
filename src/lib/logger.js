const winston = require('winston');
const util = require('util');

const { createLogger, format, transports } = winston;
const emptyTransport = {
  log: () => {},
  on: () => {},
};

const appTransports = [new transports.Console()];
if (process.env.LOG_FILE !== undefined && process.env.LOG_FILE !== '') {
  appTransports.push(new (winston.transports.File)({ filename: process.env.LOG_FILE }));
}

const winstonTransports = process.env.NODE_ENV === 'test' ? [emptyTransport] : appTransports;

const logger = createLogger({
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss ZZ' }),
    format.printf(info => `[${info.timestamp}] [${info.level}] ${info.message}`),
  ),
  transports: winstonTransports,
});
logger.stream = {
  write: (message, _encoding) => {
    logger.info(message.trim());
  },
};

logger.oldLog = logger.log;
// Give logging same behavior as console.log with multiple arguments
logger.log = (...args) => {
  logger.info(args.map(a => util.inspect(a)).join(' '));
};

module.exports = logger;
