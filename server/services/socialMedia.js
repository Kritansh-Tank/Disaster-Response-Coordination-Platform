const logger = require('../utils/logger');

// Mock social media data simulating Twitter/Bluesky posts
const MOCK_POSTS = [
  { id: 'tw-001', platform: 'twitter', user: 'citizen1', handle: '@citizen1', content: '#floodrelief Need food and water in Lower East Side, NYC. Road blocked!', hashtags: ['#floodrelief', '#NYC'], timestamp: new Date().toISOString(), urgency: 'high' },
  { id: 'tw-002', platform: 'twitter', user: 'rescueTeam5', handle: '@rescueTeam5', content: 'Deploying rescue boats near Manhattan Bridge. #NYCFlood #rescue', hashtags: ['#NYCFlood', '#rescue'], timestamp: new Date().toISOString(), urgency: 'medium' },
  { id: 'tw-003', platform: 'twitter', user: 'weatherAlert', handle: '@weatherAlert', content: 'URGENT: Flash flood warning for Manhattan area. Seek higher ground immediately! #SOS #flood', hashtags: ['#SOS', '#flood'], timestamp: new Date().toISOString(), urgency: 'critical' },
  { id: 'tw-004', platform: 'bluesky', user: 'volunteer_hub', handle: '@volunteer_hub.bsky.social', content: 'Volunteer assembly point set up at PS 64, East Village. Come help! #volunteerNYC', hashtags: ['#volunteerNYC'], timestamp: new Date().toISOString(), urgency: 'low' },
  { id: 'tw-005', platform: 'twitter', user: 'NYCemergency', handle: '@NYCemergency', content: 'Shelters open at: Brooklyn Tech HS, Javits Center, Barclays. #NYCFlood #shelter', hashtags: ['#NYCFlood', '#shelter'], timestamp: new Date().toISOString(), urgency: 'high' },
  { id: 'tw-006', platform: 'twitter', user: 'citizen_jane', handle: '@citizen_jane', content: 'SOS! Trapped on 2nd floor, water rising fast. 123 Canal St, Manhattan. #floodhelp #urgent', hashtags: ['#floodhelp', '#urgent'], timestamp: new Date().toISOString(), urgency: 'critical' },
  { id: 'tw-007', platform: 'bluesky', user: 'redcross_nyc', handle: '@redcross.bsky.social', content: 'Red Cross distributing blankets and food at Javits Center. Open 24/7. #disasterrelief', hashtags: ['#disasterrelief'], timestamp: new Date().toISOString(), urgency: 'medium' },
  { id: 'tw-008', platform: 'twitter', user: 'traffic_update', handle: '@traffic_update', content: 'FDR Drive closed due to flooding from 23rd St to Canal St. Use alternate routes. #traffic #NYCFlood', hashtags: ['#traffic', '#NYCFlood'], timestamp: new Date().toISOString(), urgency: 'medium' },
];

// Priority keywords for bonus alert system
const PRIORITY_KEYWORDS = ['urgent', 'sos', 'emergency', 'trapped', 'help', 'critical', 'rescue', 'dying', 'stranded'];

function classifyPriority(content) {
  const lower = content.toLowerCase();
  const matchedKeywords = PRIORITY_KEYWORDS.filter(kw => lower.includes(kw));
  if (matchedKeywords.length >= 2) return 'critical';
  if (matchedKeywords.length === 1) return 'high';
  return 'normal';
}

async function fetchSocialMediaPosts(disasterId, tags = []) {
  // Simulate fetching — filter mock data based on tags
  let posts = [...MOCK_POSTS].map(post => ({
    ...post,
    disaster_id: disasterId,
    computed_priority: classifyPriority(post.content),
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(), // randomize times
  }));

  if (tags.length > 0) {
    posts = posts.filter(post => {
      const content = post.content.toLowerCase();
      return tags.some(tag => content.includes(tag.toLowerCase()));
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3, low: 4 };
  posts.sort((a, b) => (priorityOrder[a.computed_priority] || 3) - (priorityOrder[b.computed_priority] || 3));

  logger.info(`Social media fetched: ${posts.length} posts`, { disasterId });
  return posts;
}

function getPriorityAlerts(posts) {
  return posts.filter(p => p.computed_priority === 'critical' || p.computed_priority === 'high');
}

module.exports = { fetchSocialMediaPosts, getPriorityAlerts, classifyPriority };
