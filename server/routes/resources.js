const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// GET /disasters/:id/resources?lat=...&lon=...&radius=... — Geospatial resource lookup
router.get('/:id/resources', async (req, res, next) => {
  try {
    const disasterId = req.params.id;
    const { lat, lon, radius } = req.query;

    if (lat && lon) {
      // Use RPC function for geospatial query
      const { data, error } = await supabase.rpc('find_nearby_resources', {
        p_lat: parseFloat(lat),
        p_lon: parseFloat(lon),
        p_radius_meters: parseFloat(radius) || 10000,
        p_disaster_id: disasterId,
      });

      if (error) throw error;

      logger.info(`Resource mapped: Found ${data.length} resources near (${lat}, ${lon})`, { disasterId });

      // Emit WebSocket event
      if (req.app.get('io')) {
        req.app.get('io').emit('resources_updated', {
          disaster_id: disasterId,
          resources: data,
          query: { lat, lon, radius },
        });
      }

      return res.json(data);
    }

    // Without coordinates, return all resources for the disaster
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('disaster_id', disasterId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /resources — Create a resource
router.post('/', async (req, res, next) => {
  try {
    const { disaster_id, name, location_name, type, latitude, longitude } = req.body;

    if (!disaster_id || !name || !type) {
      return res.status(400).json({ error: 'disaster_id, name, and type are required' });
    }

    const resourceData = {
      disaster_id,
      name,
      location_name: location_name || null,
      type,
    };

    if (latitude && longitude) {
      resourceData.location = `POINT(${longitude} ${latitude})`;
    }

    const { data, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Resource mapped: ${name} at ${location_name}`, { type, disasterId: disaster_id });

    if (req.app.get('io')) {
      req.app.get('io').emit('resources_updated', {
        disaster_id,
        action: 'created',
        resource: data,
      });
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
