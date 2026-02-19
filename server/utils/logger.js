const LOG_LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' };

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

const logger = {
  info: (message, meta) => console.log(formatLog(LOG_LEVELS.INFO, message, meta)),
  warn: (message, meta) => console.warn(formatLog(LOG_LEVELS.WARN, message, meta)),
  error: (message, meta) => console.error(formatLog(LOG_LEVELS.ERROR, message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog(LOG_LEVELS.DEBUG, message, meta));
    }
  },
};

module.exports = logger;
