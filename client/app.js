// ============================================
// Disaster Response Coordination Platform
// Frontend JavaScript
// ============================================

const API_BASE = '/api';
let currentUser = 'citizen1';
let disasters = [];
let socket;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initWebSocket();
  initForms();
  initUserSelect();
  loadDisasters();
  initMaps();
});

// ============ TABS ============
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

      // Trigger map redraws when tab becomes visible
      if (tab.dataset.tab === 'dashboard' && window.mainMap) window.mainMap.invalidateSize();
      if (tab.dataset.tab === 'resources' && window.resourceMap) window.resourceMap.invalidateSize();
      if (tab.dataset.tab === 'geocode' && window.geocodeMap) window.geocodeMap.invalidateSize();
    });
  });
}

// ============ WEBSOCKET ============
function initWebSocket() {
  socket = io();

  socket.on('connect', () => {
    document.getElementById('wsStatus').classList.add('connected');
    document.getElementById('wsStatusText').textContent = 'Connected';
    showToast('WebSocket connected', 'success');
  });

  socket.on('disconnect', () => {
    document.getElementById('wsStatus').classList.remove('connected');
    document.getElementById('wsStatusText').textContent = 'Disconnected';
    showToast('WebSocket disconnected', 'error');
  });

  socket.on('disaster_updated', (data) => {
    showToast(`Disaster ${data.action}: ${data.disaster?.title || data.disasterId}`, 'info');
    loadDisasters();
  });

  socket.on('social_media_updated', (data) => {
    showToast(`${data.new_posts} new social media posts (${data.alerts} alerts)`, 'warning');
  });

  socket.on('resources_updated', (data) => {
    showToast(`Resources updated for disaster`, 'info');
  });
}

// ============ USER SELECT ============
function initUserSelect() {
  document.getElementById('userSelect').addEventListener('change', (e) => {
    currentUser = e.target.value;
    showToast(`Switched to ${currentUser}`, 'info');
  });
}

// ============ API HELPERS ============
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUser,
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// ============ TOASTS ============
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============ MAPS ============
function initMaps() {
  // Dashboard map
  window.mainMap = L.map('map').setView([40.7128, -74.0060], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(window.mainMap);
  window.mainMapMarkers = L.layerGroup().addTo(window.mainMap);

  // Resource map
  window.resourceMap = L.map('resourceMap').setView([40.7128, -74.0060], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(window.resourceMap);
  window.resourceMapMarkers = L.layerGroup().addTo(window.resourceMap);

  // Geocode map
  window.geocodeMap = L.map('geocodeMap').setView([40.7128, -74.0060], 4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(window.geocodeMap);
  window.geocodeMapMarkers = L.layerGroup().addTo(window.geocodeMap);
}

// ============ DISASTER CRUD ============
async function loadDisasters() {
  try {
    const tag = document.getElementById('disasterTagFilter')?.value || '';
    const path = tag ? `/disasters?tag=${encodeURIComponent(tag)}` : '/disasters';
    disasters = await apiRequest(path);

    renderDisasterList();
    renderDashboardDisasters();
    updateDisasterSelects();
    updateStats();
    updateMapMarkers();
  } catch (err) {
    console.error('Failed to load disasters:', err);
  }
}

function renderDisasterList() {
  const container = document.getElementById('disasterList');
  if (disasters.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌍</div><div class="empty-state-text">No disasters found</div></div>';
    return;
  }

  container.innerHTML = disasters.map(d => `
    <div class="disaster-item" data-id="${d.id}">
      <div class="disaster-item-header">
        <div class="disaster-title">${escapeHtml(d.title)}</div>
        <div class="disaster-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editDisaster('${d.id}')" title="Edit">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteDisaster('${d.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      ${d.location_name ? `<div class="disaster-location">📍 ${escapeHtml(d.location_name)}</div>` : ''}
      ${d.description ? `<div class="disaster-desc">${escapeHtml(d.description).substring(0, 120)}...</div>` : ''}
      <div class="tag-list">${(d.tags || []).map(t => `<span class="tag tag-${getTagClass(t)}">${escapeHtml(t)}</span>`).join('')}</div>
      <div style="margin-top:8px;font-size:0.7rem;color:var(--text-muted);">Owner: ${d.owner_id} | ${new Date(d.created_at).toLocaleDateString()}</div>
    </div>
  `).join('');
}

function renderDashboardDisasters() {
  const container = document.getElementById('dashDisasterList');
  const recent = disasters.slice(0, 5);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌍</div><div class="empty-state-text">No disasters recorded</div></div>';
    return;
  }
  container.innerHTML = recent.map(d => `
    <div class="disaster-item" onclick="selectDisasterDash('${d.id}')">
      <div class="disaster-title">${escapeHtml(d.title)}</div>
      ${d.location_name ? `<div class="disaster-location">📍 ${escapeHtml(d.location_name)}</div>` : ''}
      <div class="tag-list">${(d.tags || []).map(t => `<span class="tag tag-${getTagClass(t)}">${escapeHtml(t)}</span>`).join('')}</div>
    </div>
  `).join('');
}

function updateDisasterSelects() {
  const selects = ['reportDisasterId', 'socialDisasterId', 'resourceDisasterId', 'searchResourceDisasterId', 'updatesDisasterId', 'verifyDisasterId'];
  const options = disasters.map(d => `<option value="${d.id}">${escapeHtml(d.title)}</option>`).join('');
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const firstOption = select.options[0]?.outerHTML || '<option value="">Select disaster...</option>';
      select.innerHTML = firstOption + options;
    }
  });
}

function updateMapMarkers() {
  window.mainMapMarkers.clearLayers();
  disasters.forEach(d => {
    if (d.location) {
      // Parse geography point — Supabase returns it as string or object
      const coords = parseLocation(d.location);
      if (coords) {
        const marker = L.marker([coords.lat, coords.lng]).bindPopup(`
          <b>${escapeHtml(d.title)}</b><br>
          ${d.location_name || ''}<br>
          <small>${(d.tags || []).join(', ')}</small>
        `);
        window.mainMapMarkers.addLayer(marker);
      }
    }
  });
}

function parseLocation(loc) {
  if (!loc) return null;
  if (typeof loc === 'object' && loc.coordinates) {
    return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
  }
  // Try parsing POINT string
  const match = String(loc).match(/POINT\(([^ ]+) ([^)]+)\)/);
  if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
  return null;
}

async function editDisaster(id) {
  const d = disasters.find(x => x.id === id);
  if (!d) return;

  document.getElementById('disasterEditId').value = d.id;
  document.getElementById('disasterTitle').value = d.title;
  document.getElementById('disasterLocation').value = d.location_name || '';
  document.getElementById('disasterDesc').value = d.description || '';
  document.getElementById('disasterTags').value = (d.tags || []).join(', ');

  const coords = parseLocation(d.location);
  if (coords) {
    document.getElementById('disasterLat').value = coords.lat;
    document.getElementById('disasterLng').value = coords.lng;
  }

  // Switch to disasters tab
  document.querySelector('[data-tab="disasters"]').click();
  showToast(`Editing: ${d.title}`, 'info');
}

async function deleteDisaster(id) {
  if (!confirm('Are you sure you want to delete this disaster?')) return;
  try {
    await apiRequest(`/disasters/${id}`, { method: 'DELETE' });
    showToast('Disaster deleted', 'success');
    loadDisasters();
  } catch (err) {
    console.error(err);
  }
}

function resetDisasterForm() {
  document.getElementById('disasterEditId').value = '';
  document.getElementById('disasterForm').reset();
}

// ============ SOCIAL MEDIA ============
async function loadSocialMedia() {
  const disasterId = document.getElementById('socialDisasterId').value;
  if (!disasterId) return showToast('Please select a disaster', 'warning');

  const tags = document.getElementById('socialTags').value;
  const tagsParam = tags ? `&tags=${encodeURIComponent(tags)}` : '';

  try {
    const data = await apiRequest(`/disasters/${disasterId}/social-media?${tagsParam}`);
    renderSocialFeed(data.posts, 'socialFeed');
    renderAlertFeed(data.priority_alerts);
    document.getElementById('statAlerts').textContent = data.alert_count;
  } catch (err) {
    console.error(err);
  }
}

function renderSocialFeed(posts, containerId) {
  const container = document.getElementById(containerId);
  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-text">No posts found</div></div>';
    return;
  }

  container.innerHTML = posts.map(p => `
    <div class="social-post priority-${p.computed_priority || 'normal'}">
      <div class="post-header">
        <div class="post-user">${escapeHtml(p.handle || p.user)}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="priority-badge priority-${p.computed_priority || 'normal'}">${p.computed_priority || 'normal'}</span>
          <span class="post-platform">${p.platform}</span>
        </div>
      </div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      <div class="post-meta">
        <span>🕐 ${new Date(p.timestamp).toLocaleTimeString()}</span>
        <span>${(p.hashtags || []).join(' ')}</span>
      </div>
    </div>
  `).join('');
}

function renderAlertFeed(alerts) {
  const container = document.getElementById('alertFeed');
  if (!alerts || alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No priority alerts</div></div>';
    return;
  }
  renderSocialFeed(alerts, 'alertFeed');
}

async function selectDisasterDash(id) {
  try {
    const data = await apiRequest(`/disasters/${id}/social-media`);
    renderSocialFeed(data.posts?.slice(0, 5), 'dashSocialFeed');
  } catch (err) {
    console.error(err);
  }
}

// ============ RESOURCES ============
async function searchNearbyResources() {
  const lat = document.getElementById('searchLat').value;
  const lon = document.getElementById('searchLon').value;
  const disasterId = document.getElementById('searchResourceDisasterId').value;

  if (!lat || !lon || !disasterId) return showToast('Please fill lat, lon, and select a disaster', 'warning');

  try {
    const data = await apiRequest(`/disasters/${disasterId}/resources?lat=${lat}&lon=${lon}`);
    renderResourceList(data);
    updateResourceMap(data, parseFloat(lat), parseFloat(lon));
  } catch (err) {
    console.error(err);
  }
}

function renderResourceList(resources) {
  const container = document.getElementById('resourceList');
  if (!resources || resources.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🗺️</div><div class="empty-state-text">No resources found nearby</div></div>';
    return;
  }

  const typeIcons = { shelter: '🏠', hospital: '🏥', food: '🍲', water: '💧', supplies: '📦', evacuation: '🚁', other: '📌' };

  container.innerHTML = resources.map(r => `
    <div class="disaster-item">
      <div class="disaster-title">${typeIcons[r.type] || '📌'} ${escapeHtml(r.name)}</div>
      ${r.location_name ? `<div class="disaster-location">📍 ${escapeHtml(r.location_name)}</div>` : ''}
      <div class="tag-list">
        <span class="tag tag-default">${r.type}</span>
        ${r.distance_meters ? `<span class="tag tag-default">${(r.distance_meters / 1000).toFixed(1)} km away</span>` : ''}
      </div>
    </div>
  `).join('');
}

function updateResourceMap(resources, centerLat, centerLon) {
  window.resourceMapMarkers.clearLayers();

  // Center marker
  L.marker([centerLat, centerLon], {
    icon: L.divIcon({ className: '', html: '<div style="font-size:24px;text-align:center;">📍</div>', iconSize: [30, 30], iconAnchor: [15, 30] })
  }).bindPopup('Search Location').addTo(window.resourceMapMarkers);

  // Search radius circle
  L.circle([centerLat, centerLon], { radius: 10000, color: '#6366f1', fillOpacity: 0.05, weight: 1 }).addTo(window.resourceMapMarkers);

  resources.forEach(r => {
    if (r.location_name) {
      // We don't have exact coords from the result, but we show what we have
    }
  });

  window.resourceMap.setView([centerLat, centerLon], 12);
}

// ============ OFFICIAL UPDATES ============
async function loadOfficialUpdates() {
  const disasterId = document.getElementById('updatesDisasterId').value;
  if (!disasterId) return showToast('Please select a disaster', 'warning');

  try {
    const data = await apiRequest(`/disasters/${disasterId}/official-updates`);
    renderOfficialUpdates(data);
  } catch (err) {
    console.error(err);
  }
}

function renderOfficialUpdates(updates) {
  const container = document.getElementById('updatesList');
  if (!updates || updates.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📰</div><div class="empty-state-text">No official updates available</div></div>';
    return;
  }

  container.innerHTML = updates.map(u => `
    <div class="update-item">
      <div class="update-source">${escapeHtml(u.source)}</div>
      <div class="update-title">${escapeHtml(u.title)}</div>
      ${u.summary ? `<div class="update-summary">${escapeHtml(u.summary)}</div>` : ''}
      <div style="margin-top:8px;">
        <a href="${u.url}" target="_blank" class="btn btn-secondary btn-sm">🔗 Read More</a>
        <span style="font-size:0.7rem;color:var(--text-muted);margin-left:8px;">${new Date(u.published_at).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
}

// ============ STATS ============
async function updateStats() {
  document.getElementById('statDisasters').textContent = disasters.length;

  // Fetch reports count
  try {
    const reports = await fetch(`${API_BASE}/reports`, {
      headers: { 'x-user-id': currentUser }
    }).then(r => r.json());
    document.getElementById('statReports').textContent = Array.isArray(reports) ? reports.length : 0;
  } catch (e) { /* ignore */ }

  // Fetch resources count — sum across all disasters
  let totalResources = 0;
  for (const d of disasters) {
    try {
      const resources = await fetch(`${API_BASE}/disasters/${d.id}/resources`, {
        headers: { 'x-user-id': currentUser }
      }).then(r => r.json());
      if (Array.isArray(resources)) totalResources += resources.length;
    } catch (e) { /* ignore */ }
  }
  document.getElementById('statResources').textContent = totalResources;
}

// ============ FORMS ============
function initForms() {
  // Disaster form
  document.getElementById('disasterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('disasterEditId').value;
    const body = {
      title: document.getElementById('disasterTitle').value,
      location_name: document.getElementById('disasterLocation').value || undefined,
      description: document.getElementById('disasterDesc').value,
      tags: document.getElementById('disasterTags').value.split(',').map(t => t.trim()).filter(Boolean),
      latitude: parseFloat(document.getElementById('disasterLat').value) || undefined,
      longitude: parseFloat(document.getElementById('disasterLng').value) || undefined,
    };

    try {
      if (editId) {
        await apiRequest(`/disasters/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Disaster updated!', 'success');
      } else {
        await apiRequest('/disasters', { method: 'POST', body: JSON.stringify(body) });
        showToast('Disaster created!', 'success');
      }
      resetDisasterForm();
      loadDisasters();
    } catch (err) {
      console.error(err);
    }
  });

  // Report form
  document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      disaster_id: document.getElementById('reportDisasterId').value,
      content: document.getElementById('reportContent').value,
      image_url: document.getElementById('reportImageUrl').value || undefined,
    };

    try {
      await apiRequest('/reports', { method: 'POST', body: JSON.stringify(body) });
      showToast('Report submitted!', 'success');
      document.getElementById('reportForm').reset();
      loadReports();
    } catch (err) {
      console.error(err);
    }
  });

  // Resource form
  document.getElementById('resourceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      disaster_id: document.getElementById('resourceDisasterId').value,
      name: document.getElementById('resourceName').value,
      location_name: document.getElementById('resourceLocationName').value || undefined,
      type: document.getElementById('resourceType').value,
      latitude: parseFloat(document.getElementById('resourceLat').value) || undefined,
      longitude: parseFloat(document.getElementById('resourceLng').value) || undefined,
    };

    try {
      await apiRequest('/resources', { method: 'POST', body: JSON.stringify(body) });
      showToast('Resource added!', 'success');
      document.getElementById('resourceForm').reset();
    } catch (err) {
      console.error(err);
    }
  });

  // Geocode form
  document.getElementById('geocodeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('geocodeDesc').value;
    const location_name = document.getElementById('geocodeLocation').value;

    if (!description && !location_name) return showToast('Enter a description or location name', 'warning');

    try {
      const body = {};
      if (description) body.description = description;
      if (location_name) body.location_name = location_name;

      const data = await apiRequest('/geocode', { method: 'POST', body: JSON.stringify(body) });
      renderGeocodeResults(data.locations);
    } catch (err) {
      console.error(err);
    }
  });

  // Verify form
  document.getElementById('verifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const disasterId = document.getElementById('verifyDisasterId').value;
    const image_url = document.getElementById('verifyImageUrl').value;
    const report_id = document.getElementById('verifyReportId').value;

    try {
      const data = await apiRequest(`/disasters/${disasterId}/verify-image`, {
        method: 'POST',
        body: JSON.stringify({ image_url, report_id: report_id || undefined }),
      });
      renderVerifyResult(data);
    } catch (err) {
      console.error(err);
    }
  });

  // Image preview
  document.getElementById('verifyImageUrl').addEventListener('input', (e) => {
    const url = e.target.value;
    const container = document.getElementById('imagePreview');
    if (url) {
      container.innerHTML = `<img src="${escapeHtml(url)}" style="max-width:100%;max-height:300px;border-radius:12px;border:1px solid var(--border-color);" onerror="this.outerHTML='<div class=\\'empty-state\\'><div class=\\'empty-state-icon\\'>❌</div><div class=\\'empty-state-text\\'>Failed to load image</div></div>'">`;
    } else {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📸</div><div class="empty-state-text">Enter an image URL to preview</div></div>';
    }
  });
}

// ============ REPORTS ============
async function loadReports() {
  try {
    const data = await apiRequest('/reports');
    const container = document.getElementById('reportList');

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No reports filed</div></div>';
      return;
    }

    container.innerHTML = data.map(r => `
      <div class="report-item">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:600;font-size:0.85rem;">📋 Report</span>
          <span class="verification-status status-${r.verification_status}">${r.verification_status}</span>
        </div>
        <div class="disaster-desc">${escapeHtml(r.content)}</div>
        ${r.image_url ? `<div style="margin-top:6px;font-size:0.75rem;"><a href="${r.image_url}" target="_blank" style="color:var(--accent-primary);">📸 View Image</a></div>` : ''}
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;">By ${r.user_id} | ${new Date(r.created_at).toLocaleString()}</div>
      </div>
    `).join('');

    document.getElementById('statReports').textContent = data.length;
  } catch (err) {
    console.error(err);
  }
}

// ============ GEOCODING ============
function renderGeocodeResults(locations) {
  const container = document.getElementById('geocodeResults');
  window.geocodeMapMarkers.clearLayers();

  if (!locations || locations.length === 0) {
    container.innerHTML = '<div class="geocode-result"><div style="color:var(--text-muted);">No locations found</div></div>';
    return;
  }

  container.innerHTML = locations.map(loc => {
    if (loc.coordinates) {
      const marker = L.marker([loc.coordinates.lat, loc.coordinates.lng])
        .bindPopup(`<b>${escapeHtml(loc.location_name)}</b><br>${loc.coordinates.display_name || ''}`);
      window.geocodeMapMarkers.addLayer(marker);
    }

    return `
      <div class="geocode-result" style="margin-top:12px;">
        <div class="geocode-location">📍 ${escapeHtml(loc.location_name)}</div>
        ${loc.coordinates ? `
          <div class="geocode-coords">Lat: ${loc.coordinates.lat.toFixed(6)}, Lng: ${loc.coordinates.lng.toFixed(6)}</div>
          ${loc.coordinates.display_name ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">${escapeHtml(loc.coordinates.display_name)}</div>` : ''}
        ` : '<div style="color:var(--text-muted);font-size:0.82rem;">Could not geocode this location</div>'}
      </div>
    `;
  }).join('');

  // Fit map to markers
  if (window.geocodeMapMarkers.getLayers().length > 0) {
    const group = new L.featureGroup(window.geocodeMapMarkers.getLayers());
    window.geocodeMap.fitBounds(group.getBounds().pad(0.3));
  }
}

// ============ VERIFICATION ============
function renderVerifyResult(result) {
  const container = document.getElementById('verifyResult');
  const statusClass = result.verification_status || 'unverifiable';

  container.innerHTML = `
    <div class="verification-result ${statusClass}" style="margin-top:16px;">
      <div style="font-weight:700;font-size:1rem;margin-bottom:8px;">
        ${statusClass === 'verified' ? '✅' : statusClass === 'fake' ? '❌' : '⚠️'}
        ${statusClass.toUpperCase()}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;margin-bottom:12px;">
        <div><b>Authentic:</b> ${result.is_authentic === null ? 'Unknown' : result.is_authentic ? 'Yes' : 'No'}</div>
        <div><b>Shows Disaster:</b> ${result.is_disaster === null ? 'Unknown' : result.is_disaster ? 'Yes' : 'No'}</div>
        <div><b>Disaster Type:</b> ${result.disaster_type || 'N/A'}</div>
        <div><b>Confidence:</b> ${result.confidence || 'N/A'}</div>
      </div>
      <div style="font-size:0.85rem;color:var(--text-secondary);"><b>Analysis:</b> ${escapeHtml(result.analysis || '')}</div>
    </div>
  `;
}

// ============ UTILITIES ============
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getTagClass(tag) {
  const t = tag.toLowerCase();
  if (t === 'flood') return 'flood';
  if (t === 'earthquake') return 'earthquake';
  if (t === 'fire' || t === 'wildfire') return 'fire';
  if (t === 'hurricane' || t === 'cyclone') return 'hurricane';
  if (t === 'tornado') return 'tornado';
  if (t === 'urgent') return 'urgent';
  return 'default';
}

// Load reports on tab switch
document.getElementById('nav-reports')?.addEventListener('click', loadReports);
