const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// POST /reports — Submit a report
router.post('/', async (req, res, next) => {
  try {
    const { disaster_id, content, image_url } = req.body;

    if (!disaster_id || !content) {
      return res.status(400).json({ error: 'disaster_id and content are required' });
    }

    // Verify disaster exists
    const { data: disaster, error: dErr } = await supabase
      .from('disasters')
      .select('id')
      .eq('id', disaster_id)
      .single();

    if (dErr || !disaster) return res.status(404).json({ error: 'Disaster not found' });

    const { data, error } = await supabase
      .from('reports')
      .insert({
        disaster_id,
        user_id: req.user.id,
        content,
        image_url: image_url || null,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Report submitted for disaster ${disaster_id}`, { reportId: data.id, user: req.user.id });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /reports?disaster_id=... — List reports
router.get('/', async (req, res, next) => {
  try {
    const { disaster_id } = req.query;
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false });

    if (disaster_id) {
      query = query.eq('disaster_id', disaster_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
