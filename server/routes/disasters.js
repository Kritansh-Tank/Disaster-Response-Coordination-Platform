const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// POST /disasters — Create a disaster
router.post('/', async (req, res, next) => {
  try {
    const { title, location_name, description, tags, latitude, longitude } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    const disasterData = {
      title,
      location_name: location_name || null,
      description: description || '',
      tags: tags || [],
      owner_id: req.user.id,
      audit_trail: [{ action: 'created', user_id: req.user.id, timestamp: new Date().toISOString() }],
    };

    // Set geography point if coordinates provided
    if (latitude && longitude) {
      disasterData.location = `POINT(${longitude} ${latitude})`;
    }

    const { data, error } = await supabase
      .from('disasters')
      .insert(disasterData)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Disaster created: ${title}`, { id: data.id, owner: req.user.id });

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').emit('disaster_updated', { action: 'created', disaster: data });
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /disasters — List disasters with optional tag filter
router.get('/', async (req, res, next) => {
  try {
    const { tag, search, owner } = req.query;

    let query = supabase.from('disasters').select('*').order('created_at', { ascending: false });

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (owner) {
      query = query.eq('owner_id', owner);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /disasters/:id — Get single disaster
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Disaster not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /disasters/:id — Update a disaster
router.put('/:id', async (req, res, next) => {
  try {
    const { title, location_name, description, tags, latitude, longitude } = req.body;

    // Fetch existing to append audit trail
    const { data: existing, error: fetchErr } = await supabase
      .from('disasters')
      .select('audit_trail, owner_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Disaster not found' });

    // Only owner or admin can update
    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this disaster' });
    }

    const auditTrail = existing.audit_trail || [];
    auditTrail.push({ action: 'updated', user_id: req.user.id, timestamp: new Date().toISOString() });

    const updateData = {
      ...(title && { title }),
      ...(location_name && { location_name }),
      ...(description !== undefined && { description }),
      ...(tags && { tags }),
      audit_trail: auditTrail,
      updated_at: new Date().toISOString(),
    };

    if (latitude && longitude) {
      updateData.location = `POINT(${longitude} ${latitude})`;
    }

    const { data, error } = await supabase
      .from('disasters')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Disaster updated: ${data.title}`, { id: data.id, user: req.user.id });

    if (req.app.get('io')) {
      req.app.get('io').emit('disaster_updated', { action: 'updated', disaster: data });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /disasters/:id — Delete a disaster
router.delete('/:id', async (req, res, next) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('disasters')
      .select('owner_id, title')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Disaster not found' });

    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this disaster' });
    }

    const { error } = await supabase.from('disasters').delete().eq('id', req.params.id);
    if (error) throw error;

    logger.info(`Disaster deleted: ${existing.title}`, { id: req.params.id, user: req.user.id });

    if (req.app.get('io')) {
      req.app.get('io').emit('disaster_updated', { action: 'deleted', disasterId: req.params.id });
    }

    res.json({ message: 'Disaster deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
