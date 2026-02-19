const supabase = require('../config/supabase');
const logger = require('./logger');

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getCache(key) {
  try {
    const { data, error } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .single();

    if (error || !data) return null;

    if (new Date(data.expires_at) < new Date()) {
      // Expired — delete and return null
      await supabase.from('cache').delete().eq('key', key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return data.value;
  } catch (err) {
    logger.error(`Cache read error: ${err.message}`);
    return null;
  }
}

async function setCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  try {
    const expires_at = new Date(Date.now() + ttlMs).toISOString();
    const { error } = await supabase
      .from('cache')
      .upsert({ key, value, expires_at }, { onConflict: 'key' });

    if (error) throw error;
    logger.debug(`Cache set: ${key}`, { ttlMs });
  } catch (err) {
    logger.error(`Cache write error: ${err.message}`);
  }
}

async function deleteCache(key) {
  try {
    await supabase.from('cache').delete().eq('key', key);
  } catch (err) {
    logger.error(`Cache delete error: ${err.message}`);
  }
}

module.exports = { getCache, setCache, deleteCache };
