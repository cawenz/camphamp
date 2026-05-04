// ═══════════════════════════════════════════════════════════
//  Configuration (auth.js sets up the shared Supabase client)
// ═══════════════════════════════════════════════════════════

const HAMPSHIRE_CENTER = [42.325, -72.530];
const HAMPSHIRE_ZOOM = 16;
const IS_CONFIGURED = window.CampHampAuth.isConfigured;
const db = window.CampHampAuth.db;

let currentProfile = null;

if (!IS_CONFIGURED) {
  document.getElementById('config-banner').classList.add('visible');
}

// ═══════════════════════════════════════════════════════════
//  Place taxonomy
//
//  Two-level: `layer` is the toggle group, `kind` is the
//  fine-grained subtype that drives icon + color.
// ═══════════════════════════════════════════════════════════

const LAYERS = ['landmarks', 'wayfinding', 'trees'];

const KIND_META = {
  memorial:    { layer: 'landmarks',  label: 'Memorial',    icon: '🕊', cls: 'memorial' },
  public_art:  { layer: 'landmarks',  label: 'Public art',  icon: '🎨', cls: 'art' },
  site:        { layer: 'landmarks',  label: 'Site',        icon: '📍', cls: 'site' },
  building:    { layer: 'wayfinding', label: 'Building',    icon: '🏛', cls: 'building' },
  housing:     { layer: 'wayfinding', label: 'Housing',     icon: '🏘', cls: 'housing' },
  tree:        { layer: 'trees',      label: 'Tree',        icon: '🌳', cls: 'tree' },
};
function kindsForLayer(layer) {
  return Object.entries(KIND_META).filter(([, m]) => m.layer === layer).map(([k]) => k);
}

// ═══════════════════════════════════════════════════════════
//  App state
// ═══════════════════════════════════════════════════════════

let map;
let placeLayers = {};   // { landmarks: L.layerGroup, wayfinding: ..., trees: ... }
let memoryLayer, labelLayer;
let addMode = null;     // null | 'memory' | 'place' | 'rapid'
let newMarker = null;
let geoLayer = null;
let clickLat = null, clickLng = null;
let layerVisible = { landmarks: true, wayfinding: true, trees: true, memories: true };
let uploadedFile = null;
let allMemories = [];
let allPlaces = [];

// Rapid-add mode state — admin-only "stamp many places at once" flow
let rapidLayer = 'wayfinding';
let rapidKind  = 'building';
let rapidMinZoom = null;   // session default for min_zoom
let rapidMaxZoom = null;   // session default for max_zoom
let rapidPriority = 0;     // session default for label_priority
let rapidPopup = null;     // currently-open Leaflet popup, if any
let rapidCount = 0;        // places saved during the current rapid session

// ── Demo fallback ──
const demoMemories = [
  { id: 'd1', lat: 42.3247, lng: -72.5312, title: "Div III defense — I did it!", author_name: "Sarah K. '18", category: "academic",
    description: "Defended my Division III project on community land trusts in FPH. My committee was amazing. Cried happy tears in the bathroom after.",
    date_text: "May 2018", image_path: null, links: null },
  { id: 'd2', lat: 42.3212, lng: -72.5338, title: "Sunrise at the farm", author_name: "Marcus L. '15", category: "nature",
    description: "Used to wake up at 5am for morning chores. The mist rising off the fields with Mount Holyoke in the background — nothing since has felt that peaceful.",
    date_text: "Fall 2014", image_path: null, links: null },
  { id: 'd3', lat: 42.3244, lng: -72.5348, title: "Last Red Barn show", author_name: "Jess W. '20", category: "social",
    description: "Our band played the last show before COVID shut everything down. The barn was packed. We played until midnight.",
    date_text: "March 2020", image_path: null, links: null },
];
const demoPlaces = [
  { id: 'p1', lat: 42.32615073147959, lng: -72.53028911100283,
    name: "Sander's Stop", layer: 'landmarks', kind: 'memorial', icon: '🕊',
    description: "Campus bus shelter dedicated in September 2016 to the memory of Sander Thoenes (Hampshire '91), a Dutch journalist murdered by Indonesian soldiers in 1999 while reporting on the East Timor independence vote for the Financial Times.",
    image_path: null, visible: true, details: { honoree: 'Sander Thoenes', class_year: '1991', dedicated_year: 2016 },
    links: [
      { label: "Dedication Article", url: "https://www.hampshire.edu/news/friends-alum-sander-thoenes-slain-journalist-dedicate-memorial-inspire-world-citizens" },
      { label: "Memorial Site", url: "http://www.memorialforsander.org" }
    ] },
];


// ═══════════════════════════════════════════════════════════
//  Map init
// ═══════════════════════════════════════════════════════════

map = L.map('map', {
  center: HAMPSHIRE_CENTER, zoom: HAMPSHIRE_ZOOM,
  minZoom: 14, maxZoom: 19, zoomControl: false,
});
L.control.zoom({ position: 'topright' }).addTo(map);

// Helper: build an OpenFreeMap (vector) layer with all text labels hidden.
// Re-applies the hide whenever the underlying GL style is (re-)loaded.
const OFM_ATTRIB = '&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap';
function makeOFMLayer(styleUrl) {
  const layer = L.maplibreGL({ style: styleUrl, attribution: OFM_ATTRIB });
  function hideLabelsFor(gl) {
    const layers = (gl.getStyle() && gl.getStyle().layers) || [];
    layers.forEach(l => {
      if (l.type !== 'symbol') return;
      const hasText = l.layout && l.layout['text-field'] != null;
      if (!hasText) return;
      gl.setLayoutProperty(l.id, 'visibility', 'none');
    });
  }
  layer.on('add', () => {
    const gl = layer.getMaplibreMap ? layer.getMaplibreMap() : layer._glMap;
    if (!gl) return;
    if (gl.isStyleLoaded()) hideLabelsFor(gl);
    gl.on('load', () => hideLabelsFor(gl));
    gl.on('styledata', () => hideLabelsFor(gl));
  });
  return layer;
}

const tileLayers = [
  { name: 'Bright',    icon: '🗺',
    layer: makeOFMLayer('https://tiles.openfreemap.org/styles/bright') },
  { name: 'Liberty',   icon: '🗺',
    layer: makeOFMLayer('https://tiles.openfreemap.org/styles/liberty') },
  { name: 'Positron',  icon: '🗺',
    layer: makeOFMLayer('https://tiles.openfreemap.org/styles/positron') },
  { name: 'Satellite', icon: '🛰',
    layer: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19 }) },
];
let currentTileIdx = 0;
tileLayers[0].layer.addTo(map);

function cycleTileLayer() {
  map.removeLayer(tileLayers[currentTileIdx].layer);
  currentTileIdx = (currentTileIdx + 1) % tileLayers.length;
  const next = tileLayers[currentTileIdx];
  next.layer.addTo(map);
  if (next.layer.bringToBack) next.layer.bringToBack();
  const btn = document.getElementById('btn-tiles');
  btn.innerHTML = (next.icon || '🗺') + ' ' + next.name;
}

LAYERS.forEach(l => { placeLayers[l] = L.layerGroup().addTo(map); });
memoryLayer = L.layerGroup().addTo(map);
labelLayer = L.layerGroup().addTo(map);


// ═══════════════════════════════════════════════════════════
//  Re-center
// ═══════════════════════════════════════════════════════════

function recenterMap() {
  map.setView(HAMPSHIRE_CENTER, HAMPSHIRE_ZOOM);
}


// ═══════════════════════════════════════════════════════════
//  Data loading
// ═══════════════════════════════════════════════════════════

async function loadAll() {
  if (!IS_CONFIGURED) {
    allMemories = [...demoMemories];
    allPlaces = [...demoPlaces];
    renderAll();
    return;
  }
  try {
    const [mem, plc] = await Promise.all([
      db.from('memories').select('*').eq('approved', true).order('created_at', { ascending: false }),
      db.from('places').select('*').eq('visible', true).order('created_at', { ascending: false }),
    ]);
    if (mem.error) throw mem.error;
    if (plc.error) throw plc.error;
    allMemories = mem.data || [];
    allPlaces = plc.data || [];
    renderAll();
  } catch (err) {
    console.error('Failed to load:', err);
    showToast('Failed to load data — using demo mode', true);
    allMemories = [...demoMemories];
    allPlaces = [...demoPlaces];
    renderAll();
  }
}


// ═══════════════════════════════════════════════════════════
//  Markers & labels
// ═══════════════════════════════════════════════════════════

function getImageUrl(imagePath) {
  if (!imagePath || !IS_CONFIGURED) return null;
  const { data } = db.storage.from('memories').getPublicUrl(imagePath);
  return data?.publicUrl || null;
}

// Layers whose markers render in the "POI" style (small icon + label below, no
// colored circle pin). Landmarks use the prominent pin style instead.
const POI_STYLE_LAYERS = new Set(['wayfinding', 'trees']);

// Returns the HTML for the icon glyph — emoji override on the place wins,
// otherwise the SVG from icons.js for that kind, otherwise a fallback dot.
function iconGlyphHTML(place, kindMeta) {
  if (place.icon && place.icon.trim()) {
    return `<span class="glyph-emoji">${escapeAttr(place.icon.trim())}</span>`;
  }
  const svg = window.ICONS && window.ICONS[place.kind];
  if (svg) return svg;
  return '<span class="glyph-emoji">📍</span>';
}

function createPlaceMarker(place) {
  const meta = KIND_META[place.kind] || { cls: 'building' };
  const glyph = iconGlyphHTML(place, meta);

  if (POI_STYLE_LAYERS.has(place.layer)) {
    // POI-style: small icon, name + optional subtitle below, no colored circle.
    // Subtitle (kind) only appears at high zoom — controlled via body class.
    const subtitle = KIND_META[place.kind]?.label || '';
    const pri = place.label_priority || 0;
    const html = `
      <div class="marker-poi ${meta.cls}">
        <div class="marker-poi-icon">${glyph}</div>
        <div class="marker-poi-text" data-priority="${pri}">
          <div class="marker-poi-label">${escapeAttr(place.name || '')}</div>
          ${subtitle ? `<div class="marker-poi-sub">${escapeAttr(subtitle)}</div>` : ''}
        </div>
      </div>
    `;
    const leafIcon = L.divIcon({
      html, className: '',
      iconSize: [110, 60],    // wider/taller to fit subtitle without clipping
      iconAnchor: [55, 10],   // anchor at the icon (top); text hangs below
    });
    const marker = L.marker([place.lat, place.lng], { icon: leafIcon });
    marker.on('click', () => showPlaceDetail(place));
    return marker;
  }

  // Landmark style — bold colored circle pin.
  const html = `<div class="marker-place ${meta.cls}">${glyph}</div>`;
  const leafIcon = L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
  const marker = L.marker([place.lat, place.lng], { icon: leafIcon });
  marker.on('click', () => showPlaceDetail(place));
  return marker;
}

function createMemoryMarker(mem) {
  const el = document.createElement('div');
  el.className = `marker-memory ${mem.category || 'personal'}`;
  const leafIcon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
  const marker = L.marker([mem.lat, mem.lng], { icon: leafIcon });
  marker.on('click', () => showMemoryDetail(mem));
  return marker;
}

function createPlaceLabel(place) {
  const pri = place.label_priority || 0;
  const labelIcon = L.divIcon({
    html: `<div class="landmark-label" data-priority="${pri}">${escapeAttr(place.name)}</div>`,
    className: '', iconSize: [0, 0], iconAnchor: [-18, 14],
  });
  return L.marker([place.lat, place.lng], { icon: labelIcon, interactive: false });
}

function renderAll() {
  LAYERS.forEach(l => placeLayers[l].clearLayers());
  memoryLayer.clearLayers();
  labelLayer.clearLayers();

  const z = map.getZoom();
  allPlaces.forEach(place => {
    const layer = place.layer;
    if (!placeLayers[layer]) return;
    if (!layerVisible[layer]) return;

    // Zoom-range filter: skip places outside their visibility window.
    if (place.min_zoom != null && z < place.min_zoom) return;
    if (place.max_zoom != null && z > place.max_zoom) return;

    placeLayers[layer].addLayer(createPlaceMarker(place));
    // Landmarks get a separate prominent text label off to the side.
    // POI-style layers (wayfinding/trees) carry their own label inside the marker.
    if (layer === 'landmarks') {
      labelLayer.addLayer(createPlaceLabel(place));
    }
  });

  if (layerVisible.memories) {
    allMemories.forEach(mem => memoryLayer.addLayer(createMemoryMarker(mem)));
  }

  // After markers are in the DOM, run a collision pass so labels don't overlap.
  runLabelCollision();
}

// Zoom tiers + label visibility + collision pass.
//
// Tiers:
//   low  (z <= 14): icons only, no labels at all
//   mid  (z 15-16): names visible
//   high (z >= 17): names + kind subtitle visible
map.on('zoomend', () => { renderAll(); refreshLabelVisibility(); });
map.on('moveend', runLabelCollision); // re-run after panning too — visible set changes
function refreshLabelVisibility() {
  const z = map.getZoom();

  // Landmark side-label group: visible at z >= 15 and when landmarks are on
  const showLandmarkLabels = layerVisible.landmarks && z >= 15;
  if (showLandmarkLabels && !map.hasLayer(labelLayer)) map.addLayer(labelLayer);
  if (!showLandmarkLabels && map.hasLayer(labelLayer)) map.removeLayer(labelLayer);

  // POI labels: hide below z 15. CSS reads the body class.
  document.body.classList.toggle('hide-poi-labels', z < 15);

  // Zoom tier (drives the subtitle visibility, etc.)
  document.body.classList.remove('zoom-low', 'zoom-mid', 'zoom-high');
  if (z <= 14) document.body.classList.add('zoom-low');
  else if (z <= 16) document.body.classList.add('zoom-mid');
  else document.body.classList.add('zoom-high');

  runLabelCollision();
}

// ─── Label collision ────────────────────────────────────────
// Hide labels whose on-screen rectangle overlaps a higher-priority label.
// Priority: landmark labels > building/housing labels > tree labels.
// We collect candidates, sort by priority, and hide any that overlap an
// already-placed rect.
function runLabelCollision() {
  // Need a microtask gap so freshly-rendered DOM has measurable bboxes.
  requestAnimationFrame(() => {
    const candidates = [];

    // Landmark side-labels (layer-priority 0 = wins all ties).
    document.querySelectorAll('.landmark-label').forEach(node => {
      const userPri = parseInt(node.dataset.priority || '0', 10);
      candidates.push({ node, layerPri: 0, userPri });
    });

    // POI labels (the .marker-poi-text block, which holds name + optional subtitle).
    document.querySelectorAll('.marker-poi').forEach(poi => {
      const text = poi.querySelector('.marker-poi-text');
      if (!text) return;
      const isTree = poi.classList.contains('tree');
      const userPri = parseInt(text.dataset.priority || '0', 10);
      candidates.push({ node: text, layerPri: isTree ? 2 : 1, userPri });
    });

    // Reset visibility first so previously-hidden labels can come back.
    candidates.forEach(c => c.node.classList.remove('label-hidden'));

    // Re-measure after the reset.
    requestAnimationFrame(() => {
      const rects = candidates
        .map(c => ({ ...c, rect: c.node.getBoundingClientRect() }))
        // Skip elements with no real size (e.g. CSS-hidden at this zoom)
        .filter(c => c.rect.width > 0 && c.rect.height > 0);

      // Sort by (layerPri asc, userPri desc). Lowest layerPri wins automatic
      // ties (landmark > building > tree); within a layer, higher userPri wins.
      rects.sort((a, b) => a.layerPri - b.layerPri || b.userPri - a.userPri);

      const placed = [];
      for (const c of rects) {
        const overlaps = placed.some(p => rectsOverlap(p.rect, c.rect, 2));
        if (overlaps) {
          c.node.classList.add('label-hidden');
        } else {
          placed.push(c);
        }
      }
    });
  });
}

function rectsOverlap(a, b, padding = 0) {
  return !(
    a.right + padding  < b.left   ||
    a.left  - padding  > b.right  ||
    a.bottom + padding < b.top    ||
    a.top   - padding  > b.bottom
  );
}


// ═══════════════════════════════════════════════════════════
//  Layer toggles
// ═══════════════════════════════════════════════════════════

function toggleLayer(name) {
  if (!(name in layerVisible)) return;
  layerVisible[name] = !layerVisible[name];
  const btn = document.getElementById('btn-layer-' + name);
  if (btn) btn.classList.toggle('active', layerVisible[name]);
  renderAll();
  refreshLabelVisibility();
}


// ═══════════════════════════════════════════════════════════
//  Sidebar
// ═══════════════════════════════════════════════════════════

function openSidebar(title) {
  document.getElementById('sidebar-title').textContent = title;
  document.getElementById('sidebar').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  if (addMode) exitAddMode();
}

function renderLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return '';
  const validLinks = links.filter(l => l.url && l.url.trim());
  if (validLinks.length === 0) return '';
  return `
    <div class="detail-links">
      <h4>Links</h4>
      ${validLinks.map(l => {
        const label = l.label && l.label.trim() ? l.label.trim() : l.url;
        return `<a href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeAttr(label)} ↗</a>`;
      }).join('')}
    </div>
  `;
}

function renderDetailFields(details) {
  if (!details || typeof details !== 'object') return '';
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `
    <div class="detail-fields">
      ${entries.map(([k, v]) => `
        <div class="detail-field">
          <span class="field-key">${escapeAttr(humanKey(k))}</span>
          <span class="field-val">${escapeAttr(String(v))}</span>
        </div>
      `).join('')}
    </div>
  `;
}
function humanKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function showMemoryDetail(mem) {
  openSidebar(mem.title);
  const body = document.getElementById('sidebar-body');
  const imgUrl = getImageUrl(mem.image_path);
  body.innerHTML = `
    <div class="memory-detail">
      <span class="category-badge ${mem.category || 'personal'}">${mem.category || 'memory'}</span>
      ${imgUrl ? `<img class="memory-image" src="${imgUrl}" alt="${escapeAttr(mem.title)}" onerror="this.style.display='none'">` : ''}
      <p class="description">${escapeAttr(mem.description)}</p>
      <p class="author">${escapeAttr(mem.author_name)}</p>
      ${mem.date_text ? `<p class="meta">${escapeAttr(mem.date_text)}</p>` : ''}
      ${renderLinks(mem.links)}
    </div>
  `;
}

function showPlaceDetail(place) {
  openSidebar(place.name);
  const body = document.getElementById('sidebar-body');
  const imgUrl = getImageUrl(place.image_path);
  const meta = KIND_META[place.kind] || { label: place.kind, cls: 'building' };
  body.innerHTML = `
    <div class="official-detail">
      <span class="type-badge ${meta.cls}">${escapeAttr(meta.label)}</span>
      ${imgUrl ? `<img class="memory-image" src="${imgUrl}" alt="${escapeAttr(place.name)}" onerror="this.style.display='none'">` : ''}
      ${place.description ? `<p class="description">${escapeAttr(place.description)}</p>` : ''}
      ${renderDetailFields(place.details)}
      ${renderLinks(place.links)}
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════
//  GPS / geolocation
// ═══════════════════════════════════════════════════════════

function useMyLocation() {
  const msgEl = document.getElementById('gps-msg');
  const btn = document.getElementById('gps-btn');
  btn.disabled = true;
  btn.textContent = 'Locating…';
  msgEl.className = 'gps-msg';
  msgEl.textContent = 'Searching for your location…';

  if (geoLayer) { geoLayer.clearLayers(); }
  else { geoLayer = L.layerGroup().addTo(map); }

  map.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true });

  map.once('locationfound', function(e) {
    btn.disabled = false;
    btn.textContent = '📍 Use my location';
    msgEl.className = 'gps-msg success';
    msgEl.textContent = 'Location found! Accuracy: ~' + Math.round(e.accuracy) + 'm';

    L.circle(e.latlng, {
      radius: e.accuracy, stroke: true, weight: 2, opacity: 0.6,
      fill: true, fillColor: '#009b9e', fillOpacity: 0.08, color: '#009b9e',
    }).addTo(geoLayer);

    clickLat = e.latlng.lat;
    clickLng = e.latlng.lng;

    if (newMarker) map.removeLayer(newMarker);
    const el = document.createElement('div');
    el.className = 'marker-new';
    const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    newMarker = L.marker([clickLat, clickLng], { icon }).addTo(map);

    const coordEl = document.getElementById('coord-display');
    if (coordEl) coordEl.textContent = `📍 ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;
  });

  map.once('locationerror', function() {
    btn.disabled = false;
    btn.textContent = '📍 Use my location';
    msgEl.className = 'gps-msg error';
    msgEl.textContent = 'Could not find location. Check your device privacy settings.';
  });
}


// ═══════════════════════════════════════════════════════════
//  Add mode
// ═══════════════════════════════════════════════════════════

function startAddMode(type) {
  if (!IS_CONFIGURED) {
    if (type === 'place' || type === 'rapid') return; // demo mode: admin actions disabled
  } else {
    if (!currentProfile) {
      showToast('Sign in to add', true);
      window.location.href = 'login.html';
      return;
    }
    if (currentProfile.status !== 'active') {
      showToast('Your account is disabled', true);
      return;
    }
    if ((type === 'place' || type === 'rapid') && currentProfile.role !== 'admin') {
      showToast('Admins only', true);
      return;
    }
  }

  if (type === 'rapid') {
    showRapidSetup();
    return;
  }

  addMode = type;
  const btnId = type === 'place' ? 'btn-add-place' : 'btn-add';
  document.getElementById(btnId)?.classList.add('active');

  const promptEl = document.getElementById('click-prompt');
  promptEl.textContent = type === 'place'
    ? '⚙ Admin: Click map to place a campus location'
    : 'Click anywhere on the map to place your memory';
  promptEl.classList.add('visible');
  map.getContainer().style.cursor = 'crosshair';

  clickLat = null;
  clickLng = null;
  if (type === 'place') showPlaceForm();
  else showMemoryForm();
}

function exitAddMode() {
  document.getElementById('btn-add')?.classList.remove('active');
  document.getElementById('btn-add-place')?.classList.remove('active');
  document.getElementById('btn-add-rapid')?.classList.remove('active');
  document.getElementById('click-prompt').classList.remove('visible');
  map.getContainer().style.cursor = '';
  if (newMarker) { map.removeLayer(newMarker); newMarker = null; }
  if (geoLayer) { geoLayer.clearLayers(); }
  if (rapidPopup) { map.closePopup(rapidPopup); rapidPopup = null; }
  rapidCount = 0;
  uploadedFile = null;
  addMode = null;
}

map.on('click', function(e) {
  if (!addMode) return;

  if (addMode === 'rapid') {
    openRapidPopup(e.latlng.lat, e.latlng.lng);
    return;
  }

  clickLat = e.latlng.lat;
  clickLng = e.latlng.lng;

  if (geoLayer) geoLayer.clearLayers();

  if (newMarker) map.removeLayer(newMarker);
  const el = document.createElement('div');
  el.className = 'marker-new';
  const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
  newMarker = L.marker([clickLat, clickLng], { icon }).addTo(map);

  document.getElementById('click-prompt').classList.remove('visible');

  const coordEl = document.getElementById('coord-display');
  if (coordEl) coordEl.textContent = `📍 ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;

  const gpsMsg = document.getElementById('gps-msg');
  if (gpsMsg) { gpsMsg.textContent = ''; gpsMsg.className = 'gps-msg'; }

  if (!document.getElementById('sidebar').classList.contains('open')) {
    if (addMode === 'place') showPlaceForm();
    else showMemoryForm();
  }
});


// ═══════════════════════════════════════════════════════════
//  Shared form helpers
// ═══════════════════════════════════════════════════════════

function linkFieldsHTML() {
  return `
    <div class="form-group">
      <label>Links (optional — up to 3)</label>
      <div class="link-input-group">
        ${[1,2,3].map(i => `
          <div class="link-row">
            <input type="text" id="f-link-label-${i}" placeholder="Label">
            <input type="url" id="f-link-url-${i}" placeholder="https://...">
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function gatherLinks() {
  const links = [];
  for (let i = 1; i <= 3; i++) {
    const url = document.getElementById(`f-link-url-${i}`)?.value.trim();
    const label = document.getElementById(`f-link-label-${i}`)?.value.trim();
    if (url) links.push({ label: label || '', url });
  }
  return links.length > 0 ? links : null;
}

function locationPickerHTML() {
  const coordText = (clickLat && clickLng)
    ? `📍 ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`
    : '📍 Click map or use GPS to set location';
  return `
    <div class="coord-display" id="coord-display">${coordText}</div>
    <div style="margin-top:8px; text-align:center;">
      <button type="button" class="gps-btn" id="gps-btn" onclick="useMyLocation()">📍 Use my location</button>
    </div>
    <div class="gps-msg" id="gps-msg"></div>
    <div style="height:12px"></div>
  `;
}


// ═══════════════════════════════════════════════════════════
//  Memory form
// ═══════════════════════════════════════════════════════════

function showMemoryForm() {
  openSidebar('Add a Memory');
  const body = document.getElementById('sidebar-body');
  const badge = currentProfile ? window.CampHampAuth.formatBadge(currentProfile) : '';
  const authorLine = currentProfile
    ? `<div class="memory-author-display">Posting as <strong>${escapeAttr(currentProfile.display_name)}</strong>${badge ? ` <span class="user-badge">${escapeAttr(badge)}</span>` : ''}</div>`
    : '';
  body.innerHTML = `
    ${locationPickerHTML()}
    ${authorLine}
    <div class="form-group">
      <label>Memory Title</label>
      <input type="text" id="f-title" placeholder="Give this memory a name">
    </div>
    <div class="form-group">
      <label>Category</label>
      <div class="tag-row" id="cat-row">
        <button class="tag-btn" data-cat="personal" onclick="selectCat(this)">Personal</button>
        <button class="tag-btn" data-cat="academic" onclick="selectCat(this)">Academic</button>
        <button class="tag-btn" data-cat="social" onclick="selectCat(this)">Social</button>
        <button class="tag-btn" data-cat="nature" onclick="selectCat(this)">Nature</button>
        <button class="tag-btn" data-cat="art" onclick="selectCat(this)">Art</button>
      </div>
    </div>
    <div class="form-group">
      <label>Your Memory</label>
      <textarea id="f-desc" placeholder="What happened here? What do you remember?"></textarea>
    </div>
    <div class="form-group">
      <label>When?</label>
      <input type="text" id="f-date" placeholder="e.g. Spring 2016, October 2019">
    </div>
    ${linkFieldsHTML()}
    <div class="form-group">
      <label>Photo (optional)</label>
      <div class="file-drop" id="file-drop" onclick="document.getElementById('file-input').click()">
        <p>📷 <strong>Click to upload</strong> or drag & drop</p>
        <p style="font-size:11px;margin-top:4px">JPG, PNG — auto-compressed for you</p>
        <input type="file" id="file-input" accept="image/*" onchange="handleFile(this)">
      </div>
      <div id="preview-container"></div>
    </div>
    <button class="submit-btn" id="submit-btn" onclick="saveMemory()">Save Memory</button>
  `;
}

let selectedCat = 'personal';
function selectCat(btn) {
  document.querySelectorAll('#cat-row .tag-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCat = btn.dataset.cat;
}


// ═══════════════════════════════════════════════════════════
//  Place form (admin)
// ═══════════════════════════════════════════════════════════

let placeFormLayer = 'landmarks';

function showPlaceForm() {
  openSidebar('⚙ Add a Place');
  const body = document.getElementById('sidebar-body');
  body.innerHTML = `
    ${locationPickerHTML()}
    <div class="form-group">
      <label>Layer</label>
      <div class="tag-row" id="layer-row">
        ${LAYERS.map(l => `
          <button class="tag-btn ${l === placeFormLayer ? 'selected' : ''}" data-layer="${l}"
                  onclick="selectPlaceLayer(this)">
            ${l[0].toUpperCase() + l.slice(1)}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Kind</label>
      <select id="f-kind">${kindOptionsHTML(placeFormLayer)}</select>
    </div>
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="f-name" placeholder="e.g. Franklin Patterson Hall">
    </div>
    <div class="form-group">
      <label>Icon (emoji, optional)</label>
      <input type="text" id="f-icon" placeholder="defaults to the kind's icon" maxlength="4">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="f-desc" placeholder="Describe this place…"></textarea>
    </div>
    <div class="form-group">
      <label>Zoom visibility (optional)</label>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;">
          <input type="number" id="f-min-zoom" min="0" max="22" placeholder="Min (e.g. 17)">
          <div class="hint">Hidden below this zoom</div>
        </div>
        <div style="flex:1;">
          <input type="number" id="f-max-zoom" min="0" max="22" placeholder="Max (e.g. 16)">
          <div class="hint">Hidden above this zoom</div>
        </div>
      </div>
      <div class="hint" style="margin-top:6px;">
        Map opens at zoom 16. Leave blank for always-visible.
      </div>
    </div>
    <div class="form-group">
      <label>Label priority</label>
      <select id="f-label-priority">
        <option value="0" selected>Normal</option>
        <option value="-5">Low (yields to others)</option>
        <option value="5">High (wins collisions)</option>
        <option value="10">Very high</option>
      </select>
      <div class="hint">Tiebreaker when two labels overlap.</div>
    </div>
    <div class="form-group">
      <label>Extra details (optional, JSON-style key/value)</label>
      <div id="details-rows">
        <div class="link-row details-row">
          <input type="text" class="details-key" placeholder="e.g. honoree">
          <input type="text" class="details-val" placeholder="e.g. Sander Thoenes">
        </div>
        <div class="link-row details-row">
          <input type="text" class="details-key" placeholder="key">
          <input type="text" class="details-val" placeholder="value">
        </div>
        <div class="link-row details-row">
          <input type="text" class="details-key" placeholder="key">
          <input type="text" class="details-val" placeholder="value">
        </div>
      </div>
    </div>
    ${linkFieldsHTML()}
    <div class="form-group">
      <label>Photo (optional)</label>
      <div class="file-drop" id="file-drop" onclick="document.getElementById('file-input').click()">
        <p>📷 <strong>Click to upload</strong></p>
        <input type="file" id="file-input" accept="image/*" onchange="handleFile(this)">
      </div>
      <div id="preview-container"></div>
    </div>
    <button class="submit-btn admin-submit" id="submit-btn" onclick="savePlace()">Save Place</button>
  `;
}

function kindOptionsHTML(layer) {
  return kindsForLayer(layer).map(k => {
    const m = KIND_META[k];
    return `<option value="${k}">${m.icon} ${m.label}</option>`;
  }).join('');
}

function selectPlaceLayer(btn) {
  document.querySelectorAll('#layer-row .tag-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  placeFormLayer = btn.dataset.layer;
  document.getElementById('f-kind').innerHTML = kindOptionsHTML(placeFormLayer);
}

function gatherDetails() {
  const out = {};
  document.querySelectorAll('.details-row').forEach(row => {
    const k = row.querySelector('.details-key')?.value.trim();
    const v = row.querySelector('.details-val')?.value.trim();
    if (k && v) out[k] = v;
  });
  return out;
}


// ═══════════════════════════════════════════════════════════
//  Rapid add mode (admin-only stamp-many flow)
// ═══════════════════════════════════════════════════════════

function showRapidSetup() {
  openSidebar('⚡ Rapid Add Setup');
  const body = document.getElementById('sidebar-body');
  body.innerHTML = `
    <p class="rapid-help">
      Pick a layer + kind once, then click the map to drop places one after another.
      Press <kbd>Esc</kbd> or click "Done" to exit.
    </p>
    <div class="form-group">
      <label>Layer</label>
      <div class="tag-row" id="rapid-layer-row">
        ${LAYERS.map(l => `
          <button type="button" class="tag-btn ${l === rapidLayer ? 'selected' : ''}"
                  data-layer="${l}" onclick="selectRapidLayer(this)">
            ${l[0].toUpperCase() + l.slice(1)}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Kind</label>
      <select id="f-rapid-kind">${kindOptionsHTML(rapidLayer)}</select>
    </div>
    <div class="form-group">
      <label>Zoom visibility (session default)</label>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;">
          <input type="number" id="f-rapid-min-zoom" min="0" max="22"
                 value="${rapidMinZoom ?? ''}" placeholder="Min (blank = any)">
          <div class="hint">Hidden below this zoom</div>
        </div>
        <div style="flex:1;">
          <input type="number" id="f-rapid-max-zoom" min="0" max="22"
                 value="${rapidMaxZoom ?? ''}" placeholder="Max (blank = any)">
          <div class="hint">Hidden above this zoom</div>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Label priority (session default)</label>
      <select id="f-rapid-priority">
        <option value="0"  ${rapidPriority === 0  ? 'selected' : ''}>Normal</option>
        <option value="-5" ${rapidPriority === -5 ? 'selected' : ''}>Low (yields)</option>
        <option value="5"  ${rapidPriority === 5  ? 'selected' : ''}>High (wins)</option>
        <option value="10" ${rapidPriority === 10 ? 'selected' : ''}>Very high</option>
      </select>
    </div>
    <button class="submit-btn admin-submit" onclick="enterRapidMode()">
      Start adding
    </button>
  `;
  // Pre-select the previously chosen kind if it still belongs to this layer
  const sel = document.getElementById('f-rapid-kind');
  if (sel && KIND_META[rapidKind]?.layer === rapidLayer) sel.value = rapidKind;
}

function selectRapidLayer(btn) {
  document.querySelectorAll('#rapid-layer-row .tag-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  rapidLayer = btn.dataset.layer;
  document.getElementById('f-rapid-kind').innerHTML = kindOptionsHTML(rapidLayer);
}

function enterRapidMode() {
  rapidKind = document.getElementById('f-rapid-kind').value;
  const minZ = document.getElementById('f-rapid-min-zoom').value;
  const maxZ = document.getElementById('f-rapid-max-zoom').value;
  rapidMinZoom = minZ === '' ? null : parseInt(minZ, 10);
  rapidMaxZoom = maxZ === '' ? null : parseInt(maxZ, 10);
  rapidPriority = parseInt(document.getElementById('f-rapid-priority').value, 10) || 0;
  rapidCount = 0;
  addMode = 'rapid';

  document.getElementById('btn-add-rapid')?.classList.add('active');
  closeSidebarSilent();

  updateRapidPrompt();
  map.getContainer().style.cursor = 'crosshair';
}

function closeSidebarSilent() {
  // Closes sidebar without triggering exitAddMode (which the regular
  // closeSidebar() does when addMode is set).
  document.getElementById('sidebar').classList.remove('open');
}

function updateRapidPrompt() {
  const meta = KIND_META[rapidKind];
  const promptEl = document.getElementById('click-prompt');
  promptEl.innerHTML =
    `⚡ Rapid Add: click to drop ${meta.icon} ${meta.label}` +
    (rapidCount > 0 ? ` &nbsp;·&nbsp; <strong>${rapidCount}</strong> saved` : '') +
    ` &nbsp;·&nbsp; <a href="#" onclick="event.preventDefault();exitRapidMode();" class="rapid-exit">Done</a>`;
  promptEl.classList.add('visible');
}

function exitRapidMode() {
  if (rapidPopup) { map.closePopup(rapidPopup); rapidPopup = null; }
  if (rapidCount > 0) showToast(`Added ${rapidCount} place${rapidCount === 1 ? '' : 's'}`);
  exitAddMode();
}

function openRapidPopup(lat, lng) {
  if (rapidPopup) map.closePopup(rapidPopup);
  const meta = KIND_META[rapidKind];
  const html = `
    <div class="rapid-popup">
      <div class="rapid-popup-meta">${meta.icon} ${meta.label}</div>
      <input type="text" id="rapid-name" class="rapid-name-input" placeholder="Name (Enter to save)" autocomplete="off">
      <div class="rapid-popup-actions">
        <button type="button" class="rapid-cancel" onclick="closeRapidPopup()">Cancel</button>
        <button type="button" class="rapid-save" onclick="saveRapid()">Save</button>
      </div>
    </div>
  `;
  rapidPopup = L.popup({ closeButton: false, autoClose: false, closeOnClick: false })
    .setLatLng([lat, lng])
    .setContent(html)
    .openOn(map);

  // Stash the click point on the popup so saveRapid() can read it.
  rapidPopup._rapidLat = lat;
  rapidPopup._rapidLng = lng;

  // Focus + Enter-to-submit
  setTimeout(() => {
    const input = document.getElementById('rapid-name');
    if (!input) return;
    input.focus();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveRapid(); }
      if (e.key === 'Escape') { e.preventDefault(); closeRapidPopup(); }
    });
  }, 30);
}

function closeRapidPopup() {
  if (rapidPopup) { map.closePopup(rapidPopup); rapidPopup = null; }
}

async function saveRapid() {
  const input = document.getElementById('rapid-name');
  if (!input) return;
  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  const lat = rapidPopup._rapidLat;
  const lng = rapidPopup._rapidLng;
  const layer = rapidLayer;
  const kind  = rapidKind;

  // Disable inputs while inserting
  input.disabled = true;
  document.querySelector('.rapid-save').disabled = true;

  const record = {
    lat, lng, name,
    layer, kind,
    details: {},
    min_zoom: rapidMinZoom,
    max_zoom: rapidMaxZoom,
    label_priority: rapidPriority,
  };
  if (currentProfile) record.created_by = currentProfile.id;

  try {
    if (IS_CONFIGURED) {
      const { data, error } = await db.from('places').insert([record]).select().single();
      if (error) throw error;
      allPlaces.unshift(data);
    } else {
      record.id = 'local-' + Date.now();
      record.visible = true;
      allPlaces.unshift(record);
    }
    rapidCount += 1;
    closeRapidPopup();
    renderAll();
    refreshLabelVisibility();
    updateRapidPrompt();
  } catch (err) {
    console.error('Rapid save failed:', err);
    showToast('Save failed — ' + err.message, true);
    input.disabled = false;
    const saveBtn = document.querySelector('.rapid-save');
    if (saveBtn) saveBtn.disabled = false;
  }
}

// Esc anywhere exits rapid mode.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && addMode === 'rapid' && !rapidPopup) {
    exitRapidMode();
  }
});


// ═══════════════════════════════════════════════════════════
//  File handling (with compression)
// ═══════════════════════════════════════════════════════════

async function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 25 * 1024 * 1024) {
    showToast('File too large — 25 MB max', true);
    return;
  }

  const dropEl = document.getElementById('file-drop');
  const previewEl = document.getElementById('preview-container');
  dropEl.classList.add('has-file');
  dropEl.querySelector('p').textContent = 'Compressing…';

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true,
    });
    uploadedFile = compressed;
    const sizeMB = (compressed.size / (1024 * 1024)).toFixed(1);
    dropEl.querySelector('p').textContent = `✓ ${file.name} (${sizeMB} MB)`;
    const reader = new FileReader();
    reader.onload = e => {
      previewEl.innerHTML = `<img class="preview-thumb" src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(compressed);
  } catch (err) {
    console.error('Compression failed:', err);
    uploadedFile = file;
    dropEl.querySelector('p').textContent = '✓ ' + file.name;
    const reader = new FileReader();
    reader.onload = e => {
      previewEl.innerHTML = `<img class="preview-thumb" src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  }
}

async function uploadImage(file) {
  if (!file || !IS_CONFIGURED) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { data, error } = await db.storage.from('memories').upload(filename, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  return data.path;
}


// ═══════════════════════════════════════════════════════════
//  Save handlers
// ═══════════════════════════════════════════════════════════

async function saveMemory() {
  const title = document.getElementById('f-title').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const dateText = document.getElementById('f-date').value.trim();

  if (!title || !desc) { showToast('Please add a title and description', true); return; }
  if (!clickLat || !clickLng) { showToast('Please set a location — click the map or use GPS', true); return; }
  if (IS_CONFIGURED && !currentProfile) { showToast('Sign in to save a memory', true); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>Saving...';

  try {
    let imagePath = null;
    if (uploadedFile) imagePath = await uploadImage(uploadedFile);

    const record = {
      lat: clickLat, lng: clickLng,
      title, description: desc,
      author_name: currentProfile?.display_name || 'Anonymous',
      category: selectedCat || 'personal',
      date_text: dateText || null,
      image_path: imagePath,
      links: gatherLinks(),
    };
    if (currentProfile) record.user_id = currentProfile.id;

    if (IS_CONFIGURED) {
      const { error } = await db.from('memories').insert([record]);
      if (error) throw error;
    } else {
      record.id = 'local-' + Date.now();
      allMemories.push(record);
    }

    showToast('Memory saved!');
    closeSidebar();
    exitAddMode();
    await loadAll();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save — ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Save Memory';
  }
}

async function savePlace() {
  const name = document.getElementById('f-name').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const kind = document.getElementById('f-kind').value;
  const icon = document.getElementById('f-icon').value.trim();
  const layer = placeFormLayer;
  const minZoomVal = document.getElementById('f-min-zoom').value;
  const maxZoomVal = document.getElementById('f-max-zoom').value;
  const priorityVal = document.getElementById('f-label-priority').value;

  if (!name) { showToast('Please add a name', true); return; }
  if (!clickLat || !clickLng) { showToast('Please set a location — click the map or use GPS', true); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>Saving...';

  try {
    let imagePath = null;
    if (uploadedFile) imagePath = await uploadImage(uploadedFile);

    const record = {
      lat: clickLat, lng: clickLng,
      name, description: desc || null,
      layer, kind,
      icon: icon || null,
      image_path: imagePath,
      links: gatherLinks(),
      details: gatherDetails(),
      min_zoom: minZoomVal === '' ? null : parseInt(minZoomVal, 10),
      max_zoom: maxZoomVal === '' ? null : parseInt(maxZoomVal, 10),
      label_priority: parseInt(priorityVal, 10) || 0,
    };
    if (currentProfile) record.created_by = currentProfile.id;

    if (IS_CONFIGURED) {
      const { error } = await db.from('places').insert([record]);
      if (error) throw error;
      showToast('Place saved!');
    } else {
      record.id = 'local-' + Date.now();
      record.visible = true;
      allPlaces.push(record);
      showToast('Place saved (demo mode)');
    }

    closeSidebar();
    exitAddMode();
    await loadAll();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save — ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Save Place';
  }
}


// ═══════════════════════════════════════════════════════════
//  Toast
// ═══════════════════════════════════════════════════════════

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = isError ? 'show error' : 'show';
  setTimeout(() => { toast.className = ''; }, 3000);
}


// ═══════════════════════════════════════════════════════════
//  Drag & drop
// ═══════════════════════════════════════════════════════════

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const drop = document.getElementById('file-drop');
  if (!drop) return;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handleFile(input);
  }
});


// ═══════════════════════════════════════════════════════════
//  Auth header & boot
// ═══════════════════════════════════════════════════════════

function escapeAttr(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function refreshAuthUI() {
  const signinEl = document.getElementById('btn-signin');
  const userEl = document.getElementById('header-user');
  const userNameEl = document.getElementById('header-user-name');
  const adminPortalEl = document.getElementById('btn-admin-portal');
  const placeBtn = document.getElementById('btn-add-place');
  const rapidBtn = document.getElementById('btn-add-rapid');

  if (!IS_CONFIGURED) {
    [signinEl, userEl, adminPortalEl, placeBtn, rapidBtn].forEach(el => el && (el.hidden = true));
    return;
  }

  currentProfile = await window.CampHampAuth.getProfile(true);

  if (!currentProfile) {
    signinEl.hidden = false;
    userEl.hidden = true;
    adminPortalEl.hidden = true;
    placeBtn.hidden = true;
    rapidBtn.hidden = true;
    return;
  }

  if (currentProfile.status === 'disabled') {
    showToast('Your account has been disabled', true);
    await window.CampHampAuth.signOut();
    currentProfile = null;
    signinEl.hidden = false;
    userEl.hidden = true;
    adminPortalEl.hidden = true;
    placeBtn.hidden = true;
    rapidBtn.hidden = true;
    return;
  }

  signinEl.hidden = true;
  userEl.hidden = false;
  const badge = window.CampHampAuth.formatBadge(currentProfile);
  userNameEl.innerHTML = escapeAttr(currentProfile.display_name)
    + (badge ? ` <span class="user-badge">${escapeAttr(badge)}</span>` : '');

  const isAdmin = currentProfile.role === 'admin';
  adminPortalEl.hidden = !isAdmin;
  placeBtn.hidden = !isAdmin;
  rapidBtn.hidden = !isAdmin;
}

document.getElementById('btn-signout')?.addEventListener('click', async () => {
  await window.CampHampAuth.signOut();
  currentProfile = null;
  await refreshAuthUI();
  showToast('Signed out');
});

if (IS_CONFIGURED) {
  db.auth.onAuthStateChange(() => { refreshAuthUI(); });
}

// ═══════════════════════════════════════════════════════════
//  Legend — populated from KIND_META so it always matches the
//  current marker rendering.
// ═══════════════════════════════════════════════════════════

function buildLegend() {
  const body = document.getElementById('legend-body');
  if (!body) return;
  const sections = [
    { title: 'Landmarks',  kinds: ['memorial','public_art','named_location','cultural','nature'] },
    { title: 'Wayfinding', kinds: ['building','housing'] },
    { title: 'Trees',      kinds: ['tree'] },
  ];

  let html = '';
  for (const sec of sections) {
    html += `<div class="legend-section">${sec.title}</div>`;
    for (const k of sec.kinds) {
      const meta = KIND_META[k];
      if (!meta) continue;
      const isPoi = POI_STYLE_LAYERS.has(meta.layer);
      const glyph = (window.ICONS && window.ICONS[k]) || `<span>${meta.icon || '📍'}</span>`;
      const swatch = isPoi
        ? `<div class="legend-icon legend-poi ${meta.cls}">${glyph}</div>`
        : `<div class="legend-icon legend-pin ${meta.cls}">${glyph}</div>`;
      html += `<div class="legend-item">${swatch}<span>${escapeAttr(meta.label)}</span></div>`;
    }
  }
  // Memories
  html += `<div class="legend-section">Memories</div>`;
  html += `<div class="legend-item">
             <div class="legend-icon legend-memory"></div>
             <span>User memory</span>
           </div>`;
  body.innerHTML = html;
}

function toggleLegend() {
  document.getElementById('legend').classList.toggle('expanded');
}


// ═══════════════════════════════════════════════════════════
//  Boot
// ═══════════════════════════════════════════════════════════

(async function boot() {
  buildLegend();
  await refreshAuthUI();
  await loadAll();
  refreshLabelVisibility();
})();
