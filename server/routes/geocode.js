const express = require('express');
const router = express.Router();
const { extractLocation } = require('../services/gemini');
const { geocode } = require('../services/geocoding');
const { getCache, setCache } = require('../utils/cache');
const { externalApiLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// POST /geocode — Extract location from description + geocode it
router.post('/', externalApiLimiter, async (req, res, next) => {
  try {
    const { description, location_name } = req.body;

    if (!description && !location_name) {
      return res.status(400).json({ error: 'Provide either description or location_name' });
    }

    let locations = [];

    if (location_name) {
      // Direct geocode from location name
      locations = [location_name];
    } else {
      // Extract locations from description using Gemini
      const cacheKey = `gemini_extract:${description.substring(0, 100)}`;
      const cached = await getCache(cacheKey);

      if (cached) {
        locations = cached;
      } else {
        locations = await extractLocation(description);
        if (locations.length > 0) {
          await setCache(cacheKey, locations);
        }
      }
    }

    if (locations.length === 0) {
      return res.json({ locations: [], message: 'No locations found in description' });
    }

    // Geocode each extracted location
    const results = [];
    for (const loc of locations) {
      const geoCacheKey = `geocode:${loc}`;
      let geoResult = await getCache(geoCacheKey);

      if (!geoResult) {
        geoResult = await geocode(loc);
        if (geoResult) {
          await setCache(geoCacheKey, geoResult);
        }
      }

      results.push({
        location_name: loc,
        coordinates: geoResult,
      });
    }

    logger.info(`Geocoding completed`, { locationCount: results.length });
    res.json({ locations: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
