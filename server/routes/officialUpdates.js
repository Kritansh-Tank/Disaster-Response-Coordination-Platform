const express = require('express');
const router = express.Router();
const { fetchOfficialUpdates } = require('../services/officialUpdates');
const { getCache, setCache } = require('../utils/cache');
const { externalApiLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// GET /disasters/:id/official-updates — Fetch official updates
router.get('/:id/official-updates', externalApiLimiter, async (req, res, next) => {
  try {
    const disasterId = req.params.id;
    const cacheKey = `official_updates:${disasterId}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info(`Official updates served from cache`, { disasterId });
      return res.json(cached);
    }

    const updates = await fetchOfficialUpdates(disasterId);

    await setCache(cacheKey, updates, 60 * 60 * 1000); // 1 hour TTL

    logger.info(`Official updates fetched`, { disasterId, count: updates.length });
    res.json(updates);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
