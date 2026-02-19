const express = require('express');
const router = express.Router();
const { fetchSocialMediaPosts, getPriorityAlerts } = require('../services/socialMedia');
const { getCache, setCache } = require('../utils/cache');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// GET /disasters/:id/social-media — Fetch social media reports
router.get('/:id/social-media', async (req, res, next) => {
  try {
    const disasterId = req.params.id;
    const { tags } = req.query; // comma-separated tags

    const cacheKey = `social_media:${disasterId}:${tags || 'all'}`;
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const tagArray = tags ? tags.split(',').map(t => t.trim()) : [];
    const posts = await fetchSocialMediaPosts(disasterId, tagArray);
    const priorityAlerts = getPriorityAlerts(posts);

    const result = {
      posts,
      priority_alerts: priorityAlerts,
      total: posts.length,
      alert_count: priorityAlerts.length,
    };

    await setCache(cacheKey, result, 5 * 60 * 1000); // 5 min TTL for social media

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').emit('social_media_updated', {
        disaster_id: disasterId,
        new_posts: posts.length,
        alerts: priorityAlerts.length,
      });
    }

    logger.info(`Social media fetched for disaster`, { disasterId, posts: posts.length, alerts: priorityAlerts.length });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /mock-social-media — Mock endpoint per assignment spec
router.get('/mock-social-media', async (req, res, next) => {
  try {
    const posts = await fetchSocialMediaPosts('mock', []);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
