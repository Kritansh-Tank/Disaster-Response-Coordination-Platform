const fetch = require('node-fetch');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

// Official sources to scrape
const OFFICIAL_SOURCES = [
  {
    name: 'FEMA',
    url: 'https://www.fema.gov/about/news-multimedia/press-releases',
    selector: '.views-row',
    titleSelector: 'h3 a, .views-field-title a',
    linkPrefix: 'https://www.fema.gov',
  },
  {
    name: 'Red Cross',
    url: 'https://www.redcross.org/about-us/news-and-events/press-releases.html',
    selector: '.press-release-item, .content-item',
    titleSelector: 'h3 a, h4 a, a.title',
    linkPrefix: 'https://www.redcross.org',
  },
];

// Fallback mock data in case scraping fails (handles rate limits and blocks)
const MOCK_UPDATES = [
  {
    source: 'FEMA',
    title: 'FEMA Declares Major Disaster for NYC Flooding',
    summary: 'Federal Emergency Management Agency has declared a major disaster for the NYC metropolitan area following severe flooding. Emergency assistance is available for affected residents.',
    url: 'https://www.fema.gov/press-release/nyc-flood-disaster-declaration',
    published_at: new Date().toISOString(),
    type: 'declaration',
  },
  {
    source: 'FEMA',
    title: 'Individual Assistance Available for Flood Victims',
    summary: 'Residents in affected areas can now apply for individual assistance including temporary housing, home repairs, and other disaster-related expenses.',
    url: 'https://www.fema.gov/press-release/individual-assistance-flood',
    published_at: new Date(Date.now() - 3600000).toISOString(),
    type: 'assistance',
  },
  {
    source: 'Red Cross',
    title: 'Red Cross Opens Emergency Shelters Across NYC',
    summary: 'The American Red Cross has opened 15 emergency shelters across New York City boroughs. Shelters provide food, water, cots, and basic necessities.',
    url: 'https://www.redcross.org/press-release/nyc-shelters-open',
    published_at: new Date(Date.now() - 7200000).toISOString(),
    type: 'shelter',
  },
  {
    source: 'FEMA',
    title: 'Disaster Recovery Centers Now Open',
    summary: 'Multiple Disaster Recovery Centers are now operational in Manhattan, Brooklyn, and Queens. Visit in person for assistance with applications.',
    url: 'https://www.fema.gov/press-release/recovery-centers-open',
    published_at: new Date(Date.now() - 10800000).toISOString(),
    type: 'recovery',
  },
  {
    source: 'Red Cross',
    title: 'Blood Donation Urgently Needed',
    summary: 'Due to the disaster, blood supply is critically low. The Red Cross urges eligible donors to schedule appointments at local donation centers.',
    url: 'https://www.redcross.org/press-release/blood-donation-urgent',
    published_at: new Date(Date.now() - 14400000).toISOString(),
    type: 'donation',
  },
];

async function fetchOfficialUpdates(disasterId) {
  const allUpdates = [];

  for (const source of OFFICIAL_SOURCES) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (DisasterResponsePlatform/1.0)',
          Accept: 'text/html',
        },
        timeout: 5000,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      $(source.selector).each((i, el) => {
        if (i >= 5) return false; // Limit to 5 per source
        const titleEl = $(el).find(source.titleSelector);
        const title = titleEl.text().trim();
        const href = titleEl.attr('href');

        if (title) {
          allUpdates.push({
            source: source.name,
            title,
            url: href?.startsWith('http') ? href : `${source.linkPrefix}${href}`,
            published_at: new Date().toISOString(),
            disaster_id: disasterId,
          });
        }
      });

      logger.info(`Fetched official updates from ${source.name}`, { count: allUpdates.length });
    } catch (err) {
      logger.warn(`Failed to scrape ${source.name}: ${err.message}. Using mock data.`);
    }
  }

  // If scraping returned nothing, use mock data
  if (allUpdates.length === 0) {
    logger.info('Using mock official updates (scraping failed or blocked)');
    return MOCK_UPDATES.map(u => ({ ...u, disaster_id: disasterId }));
  }

  return allUpdates;
}

module.exports = { fetchOfficialUpdates };
