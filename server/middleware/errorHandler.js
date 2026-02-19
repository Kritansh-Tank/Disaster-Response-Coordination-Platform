const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, path: req.path });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
