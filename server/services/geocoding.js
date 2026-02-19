const fetch = require('node-fetch');
const logger = require('../utils/logger');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function geocode(locationName) {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'DisasterResponsePlatform/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      logger.warn(`No geocoding results for: ${locationName}`);
      return null;
    }

    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name,
      place_id: data[0].place_id,
    };

    logger.info(`Geocoded location`, { locationName, lat: result.lat, lng: result.lng });
    return result;
  } catch (err) {
    logger.error(`Geocoding error: ${err.message}`, { locationName });
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'DisasterResponsePlatform/1.0' },
    });

    if (!response.ok) throw new Error(`Nominatim reverse geocode error: ${response.status}`);

    const data = await response.json();
    return {
      display_name: data.display_name,
      address: data.address,
    };
  } catch (err) {
    logger.error(`Reverse geocoding error: ${err.message}`);
    return null;
  }
}

module.exports = { geocode, reverseGeocode };
