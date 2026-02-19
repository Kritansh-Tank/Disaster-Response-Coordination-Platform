const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyImage } = require('../services/gemini');
const { getCache, setCache } = require('../utils/cache');
const { externalApiLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// POST /disasters/:id/verify-image — Verify a report's image using Gemini
router.post('/:id/verify-image', externalApiLimiter, async (req, res, next) => {
  try {
    const disasterId = req.params.id;
    const { report_id, image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    // Check cache
    const cacheKey = `verify_image:${image_url}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch disaster context
    const { data: disaster } = await supabase
      .from('disasters')
      .select('title, description')
      .eq('id', disasterId)
      .single();

    const context = disaster ? `Disaster: ${disaster.title}. ${disaster.description}` : '';

    // Verify with Gemini
    const verification = await verifyImage(image_url, context);

    // Update report verification status if report_id provided
    if (report_id) {
      await supabase
        .from('reports')
        .update({ verification_status: verification.verification_status })
        .eq('id', report_id);

      logger.info(`Report verification updated`, { reportId: report_id, status: verification.verification_status });
    }

    // Cache result
    await setCache(cacheKey, verification, 60 * 60 * 1000);

    res.json(verification);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
