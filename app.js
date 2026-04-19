// ═══════════════════════════════════════════════════════════
//  Configuration (loaded from config.js — see config.example.js)
// ═══════════════════════════════════════════════════════════

const _cfg = (typeof CAMPHAMP_CONFIG !== 'undefined') ? CAMPHAMP_CONFIG : {};
const SUPABASE_URL      = _cfg.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = _cfg.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const ADMIN_PASSPHRASE  = _cfg.ADMIN_PASSPHRASE || 'admin';

// ═══════════════════════════════════════════════════════════

const HAMPSHIRE_CENTER = [42.325, -72.530];
const HAMPSHIRE_ZOOM = 16;
const IS_CONFIGURED = SUPABASE_URL !== 'YOUR_SUPABASE_URL';

let db = null;
if (IS_CONFIGURED) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  document.getElementById('config-banner').classList.add('visible');
}

// ── App State ──
let map, officialLayer, memoryLayer, labelLayer;
let addMode = null; // null | 'memory' | 'official'
let newMarker = null;
let geoLayer = null;
let clickLat = null, clickLng = null;
let showOfficial = true, showMemories = true;
let uploadedFile = null;
let allMemories = [];

// ── Fallback demo data ──
const demoMemories = [
  { id: 'd1', lat: 42.3247, lng: -72.5312, title: "Div III defense — I did it!", author_name: "Sarah K. '18", category: "academic", description: "Defended my Division III project on community land trusts in FPH. My committee was amazing. Cried happy tears in the bathroom after.", date_text: "May 2018", is_official: false, image_path: null, links: null },
  { id: 'd2', lat: 42.3212, lng: -72.5338, title: "Sunrise at the farm", author_name: "Marcus L. '15", category: "nature", description: "Used to wake up at 5am for morning chores. The mist rising off the fields with Mount Holyoke in the background — nothing since has felt that peaceful.", date_text: "Fall 2014", is_official: false, image_path: null, links: null },
  { id: 'd3', lat: 42.3244, lng: -72.5348, title: "Last Red Barn show", author_name: "Jess W. '20", category: "social", description: "Our band played the last show before COVID shut everything down. The barn was packed. We played until midnight. I think about this night constantly.", date_text: "March 2020", is_official: false, image_path: null, links: null },
  { id: 'd4', lat: 42.3252, lng: -72.5328, title: "Darkroom revelation", author_name: "Andre T. '16", category: "art", description: "Spent 72 hours in the Liebling darkroom finishing my photo series. At 3am, watching a print emerge in the developer tray, I knew this was what I wanted to do with my life.", date_text: "Spring 2016", is_official: false, image_path: null, links: null },
  { id: 'd5', lat: 42.3237, lng: -72.5282, title: "Kern Center opening day", author_name: "Prof. Danielle R.", category: "personal", description: "Watching students drink rainwater harvested from the roof for the first time, knowing this building would outlast all of us — that was Hampshire at its best.", date_text: "April 2017", is_official: false, image_path: null, links: null },
  // Official: Sander's Stop
  { id: 'o1', lat: 42.32615073147959, lng: -72.53028911100283, title: "Sander's Stop",
    author_name: "Hampshire College", category: "personal",
    description: "Campus bus shelter dedicated in September 2016 to the memory of Sander Thoenes (Hampshire '91), a Dutch journalist murdered by Indonesian soldiers in September 1999 while reporting on the East Timor independence vote for the Financial Times. His friends and former professors funded the memorial at the spot where Thoenes frequently caught the PVTA bus to Five College classes. The plaque reads: \"Whatever journey you are about to take, you have the power to make it count.\" A companion scholarship fund has supported Hampshire students pursuing journalism, human rights, and peace-building for over 15 years.",
    is_official: true, official_type: "memorial", icon: "🕊",
    links: [
      { label: "Dedication Article", url: "https://www.hampshire.edu/news/friends-alum-sander-thoenes-slain-journalist-dedicate-memorial-inspire-world-citizens" },
      { label: "Memorial Site", url: "http://www.memorialforsander.org" }
    ] },
];


// ═══════════════════════════════════════
//  Initialize Map
// ═══════════════════════════════════════

map = L.map('map', {
  center: HAMPSHIRE_CENTER, zoom: HAMPSHIRE_ZOOM,
  minZoom: 14, maxZoom: 19, zoomControl: false,
});
L.control.zoom({ position: 'topright' }).addTo(map);

// ── Tile Layers ──
const tileLayers = [
  {
    name: 'Street',
    layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20,
    }),
  },
  {
    name: 'Satellite',
    layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19,
    }),
  },
  {
    name: 'Topo',
    layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap', maxZoom: 17,
    }),
  },
];

let currentTileIdx = 0;
tileLayers[0].layer.addTo(map);

function cycleTileLayer() {
  map.removeLayer(tileLayers[currentTileIdx].layer);
  currentTileIdx = (currentTileIdx + 1) % tileLayers.length;
  tileLayers[currentTileIdx].layer.addTo(map);
  tileLayers[currentTileIdx].layer.bringToBack();
  const btn = document.getElementById('btn-tiles');
  const icons = { 'Street': '🗺', 'Satellite': '🛰', 'Topo': '⛰' };
  btn.innerHTML = icons[tileLayers[currentTileIdx].name] + ' ' + tileLayers[currentTileIdx].name;
}

officialLayer = L.layerGroup().addTo(map);
memoryLayer = L.layerGroup().addTo(map);
labelLayer = L.layerGroup().addTo(map);


// ═══════════════════════════════════════
//  Re-center
// ═══════════════════════════════════════

function recenterMap() {
  map.setView(HAMPSHIRE_CENTER, HAMPSHIRE_ZOOM);
}


// ═══════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════

async function loadMemories() {
  if (!IS_CONFIGURED) {
    allMemories = [...demoMemories];
    renderMarkers();
    return;
  }

  try {
    const { data, error } = await db
      .from('memories')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    allMemories = data || [];
    renderMarkers();
  } catch (err) {
    console.error('Failed to load memories:', err);
    showToast('Failed to load data — using demo mode', true);
    allMemories = [...demoMemories];
    renderMarkers();
  }
}


// ═══════════════════════════════════════
//  Markers & Labels
// ═══════════════════════════════════════

function getImageUrl(imagePath) {
  if (!imagePath || !IS_CONFIGURED) return null;
  const { data } = db.storage.from('memories').getPublicUrl(imagePath);
  return data?.publicUrl || null;
}

function createOfficialMarker(mem) {
  const typeClass = mem.official_type || 'building';
  const icon = mem.icon || '📍';
  const el = document.createElement('div');
  el.className = `marker-official ${typeClass}`;
  el.textContent = icon;
  const leafIcon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
  const marker = L.marker([mem.lat, mem.lng], { icon: leafIcon });
  marker.on('click', () => showDetail(mem));
  return marker;
}

function createMemoryMarker(mem) {
  const el = document.createElement('div');
  el.className = `marker-memory ${mem.category || 'personal'}`;
  const leafIcon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
  const marker = L.marker([mem.lat, mem.lng], { icon: leafIcon });
  marker.on('click', () => showDetail(mem));
  return marker;
}

function createLandmarkLabel(mem) {
  const labelIcon = L.divIcon({
    html: `<div class="landmark-label">${mem.title}</div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [-18, 14], // offset to the right of the marker
  });
  return L.marker([mem.lat, mem.lng], { icon: labelIcon, interactive: false });
}

function renderMarkers() {
  officialLayer.clearLayers();
  memoryLayer.clearLayers();
  labelLayer.clearLayers();

  allMemories.forEach(mem => {
    if (mem.is_official && showOfficial) {
      officialLayer.addLayer(createOfficialMarker(mem));
      labelLayer.addLayer(createLandmarkLabel(mem));
    } else if (!mem.is_official && showMemories) {
      memoryLayer.addLayer(createMemoryMarker(mem));
    }
  });
}

// Show/hide labels based on zoom
map.on('zoomend', function() {
  const zoom = map.getZoom();
  if (zoom >= 16 && showOfficial) {
    if (!map.hasLayer(labelLayer)) map.addLayer(labelLayer);
  } else {
    if (map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
  }
});


// ═══════════════════════════════════════
//  Layer Toggles
// ═══════════════════════════════════════

function toggleLayer(layer) {
  if (layer === 'official') {
    showOfficial = !showOfficial;
    document.getElementById('btn-official').classList.toggle('active', showOfficial);
    // Toggle labels with official layer
    if (showOfficial && map.getZoom() >= 16) {
      if (!map.hasLayer(labelLayer)) map.addLayer(labelLayer);
    } else {
      if (map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
    }
  } else {
    showMemories = !showMemories;
    document.getElementById('btn-memories').classList.toggle('active', showMemories);
  }
  renderMarkers();
}


// ═══════════════════════════════════════
//  Sidebar
// ═══════════════════════════════════════

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
        return `<a href="${l.url}" target="_blank" rel="noopener">${label} ↗</a>`;
      }).join('')}
    </div>
  `;
}

function showDetail(mem) {
  openSidebar(mem.title);
  const body = document.getElementById('sidebar-body');
  const imgUrl = getImageUrl(mem.image_path);
  const badgeClass = mem.is_official ? (mem.official_type || 'building') : mem.category;
  const badgeLabel = mem.is_official ? (mem.official_type || 'official') : mem.category;

  body.innerHTML = `
    <div class="${mem.is_official ? 'official-detail' : 'memory-detail'}">
      <span class="${mem.is_official ? 'type-badge' : 'category-badge'} ${badgeClass}">${badgeLabel}</span>
      ${imgUrl ? `<img class="memory-image" src="${imgUrl}" alt="${mem.title}" onerror="this.style.display='none'">` : ''}
      <p class="description">${mem.description}</p>
      <p class="author">${mem.author_name}</p>
      ${mem.date_text ? `<p class="meta">${mem.date_text}</p>` : ''}
      ${renderLinks(mem.links)}
    </div>
  `;
}


// ═══════════════════════════════════════
//  GPS / Geolocation
// ═══════════════════════════════════════

function useMyLocation() {
  const msgEl = document.getElementById('gps-msg');
  const btn = document.getElementById('gps-btn');
  btn.disabled = true;
  btn.textContent = 'Locating…';
  msgEl.className = 'gps-msg';
  msgEl.textContent = 'Searching for your location…';

  // Clean up previous geo markers
  if (geoLayer) { geoLayer.clearLayers(); }
  else { geoLayer = L.layerGroup().addTo(map); }

  map.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true });

  map.once('locationfound', function(e) {
    btn.disabled = false;
    btn.textContent = '📍 Use my location';
    msgEl.className = 'gps-msg success';
    msgEl.textContent = 'Location found! Accuracy: ~' + Math.round(e.accuracy) + 'm';

    // Show accuracy circle
    L.circle(e.latlng, {
      radius: e.accuracy,
      stroke: true, weight: 2, opacity: 0.6,
      fill: true, fillColor: '#009b9e', fillOpacity: 0.08,
      color: '#009b9e',
    }).addTo(geoLayer);

    // Set coordinates
    clickLat = e.latlng.lat;
    clickLng = e.latlng.lng;

    // Place/move the marker
    if (newMarker) map.removeLayer(newMarker);
    const el = document.createElement('div');
    el.className = 'marker-new';
    const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    newMarker = L.marker([clickLat, clickLng], { icon }).addTo(map);

    // Update coord display
    const coordEl = document.getElementById('coord-display');
    if (coordEl) coordEl.textContent = `📍 ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;
  });

  map.once('locationerror', function(e) {
    btn.disabled = false;
    btn.textContent = '📍 Use my location';
    msgEl.className = 'gps-msg error';
    msgEl.textContent = 'Could not find location. Check your device privacy settings.';
  });
}


// ═══════════════════════════════════════
//  Add Mode
// ═══════════════════════════════════════

function startAddMode(type) {
  if (type === 'official') {
    const pass = prompt('Enter admin passphrase:');
    if (pass !== ADMIN_PASSPHRASE) {
      showToast('Invalid passphrase', true);
      return;
    }
  }

  addMode = type;
  const btn = type === 'official' ? 'btn-admin' : 'btn-add';
  document.getElementById(btn).classList.add('active');

  const prompt_el = document.getElementById('click-prompt');
  prompt_el.textContent = type === 'official'
    ? '⚙ Admin: Click map to place an official point'
    : 'Click anywhere on the map to place your memory';
  prompt_el.classList.add('visible');
  map.getContainer().style.cursor = 'crosshair';

  // Also show the form immediately with GPS option (no click required)
  clickLat = null;
  clickLng = null;
  if (type === 'official') showAdminForm();
  else showMemoryForm();
}

function exitAddMode() {
  document.getElementById('btn-add').classList.remove('active');
  document.getElementById('btn-admin').classList.remove('active');
  document.getElementById('click-prompt').classList.remove('visible');
  map.getContainer().style.cursor = '';
  if (newMarker) { map.removeLayer(newMarker); newMarker = null; }
  if (geoLayer) { geoLayer.clearLayers(); }
  uploadedFile = null;
  addMode = null;
}

map.on('click', function(e) {
  if (!addMode) return;
  clickLat = e.latlng.lat;
  clickLng = e.latlng.lng;

  // Clear geo accuracy circle
  if (geoLayer) geoLayer.clearLayers();

  if (newMarker) map.removeLayer(newMarker);
  const el = document.createElement('div');
  el.className = 'marker-new';
  const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
  newMarker = L.marker([clickLat, clickLng], { icon }).addTo(map);

  document.getElementById('click-prompt').classList.remove('visible');

  // Update coord display in the form
  const coordEl = document.getElementById('coord-display');
  if (coordEl) coordEl.textContent = `📍 ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`;

  // Clear GPS message
  const gpsMsg = document.getElementById('gps-msg');
  if (gpsMsg) { gpsMsg.textContent = ''; gpsMsg.className = 'gps-msg'; }

  // If form isn't open yet, open it
  if (!document.getElementById('sidebar').classList.contains('open')) {
    if (addMode === 'official') showAdminForm();
    else showMemoryForm();
  }
});


// ═══════════════════════════════════════
//  Link Fields HTML helper
// ═══════════════════════════════════════

function linkFieldsHTML() {
  return `
    <div class="form-group">
      <label>Links (optional — up to 3)</label>
      <div class="link-input-group">
        <div class="link-row">
          <input type="text" id="f-link-label-1" placeholder="Label">
          <input type="url" id="f-link-url-1" placeholder="https://...">
        </div>
        <div class="link-row">
          <input type="text" id="f-link-label-2" placeholder="Label">
          <input type="url" id="f-link-url-2" placeholder="https://...">
        </div>
        <div class="link-row">
          <input type="text" id="f-link-label-3" placeholder="Label">
          <input type="url" id="f-link-url-3" placeholder="https://...">
        </div>
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


// ═══════════════════════════════════════
//  GPS + Coord display HTML helper
// ═══════════════════════════════════════

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


// ═══════════════════════════════════════
//  Memory Form
// ═══════════════════════════════════════

function showMemoryForm() {
  openSidebar('Add a Memory');
  const body = document.getElementById('sidebar-body');
  body.innerHTML = `
    ${locationPickerHTML()}
    <div class="form-group">
      <label>Your Name</label>
      <input type="text" id="f-author" placeholder="e.g. Alex R. '19">
    </div>
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
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCat = btn.dataset.cat;
}


// ═══════════════════════════════════════
//  Admin Form
// ═══════════════════════════════════════

function showAdminForm() {
  openSidebar('⚙ Add Official Point');
  const body = document.getElementById('sidebar-body');
  body.innerHTML = `
    ${locationPickerHTML()}
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="f-title" placeholder="e.g. Franklin Patterson Hall">
    </div>
    <div class="form-group">
      <label>Type</label>
      <select id="f-officialtype">
        <option value="building">🏛 Building</option>
        <option value="cultural">📜 Cultural Site</option>
        <option value="art">🎨 Art / Gallery</option>
        <option value="nature">🌿 Nature / Farm</option>
        <option value="memorial">🕊 Memorial</option>
        <option value="housing">🏘 Housing</option>
      </select>
    </div>
    <div class="form-group">
      <label>Icon (emoji)</label>
      <input type="text" id="f-icon" placeholder="e.g. 🎓" maxlength="4">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="f-desc" placeholder="Describe this place..."></textarea>
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
    <button class="submit-btn admin-submit" id="submit-btn" onclick="saveOfficial()">Save Official Point</button>
  `;
}


// ═══════════════════════════════════════
//  File Handling (with compression)
// ═══════════════════════════════════════

async function handleFile(input) {
  const file = input.files[0];
  if (!file) return;

  // Reject files over 25 MB raw (generous pre-compression limit)
  if (file.size > 25 * 1024 * 1024) {
    showToast('File too large — 25 MB max', true);
    return;
  }

  const dropEl = document.getElementById('file-drop');
  const previewEl = document.getElementById('preview-container');

  // Show compressing state
  dropEl.classList.add('has-file');
  dropEl.querySelector('p').textContent = 'Compressing…';

  try {
    // Compress: max 1 MB, max 1600px wide
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    });

    uploadedFile = compressed;

    const sizeMB = (compressed.size / (1024 * 1024)).toFixed(1);
    dropEl.querySelector('p').textContent = `✓ ${file.name} (${sizeMB} MB)`;

    // Preview
    const reader = new FileReader();
    reader.onload = function(e) {
      previewEl.innerHTML = `<img class="preview-thumb" src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(compressed);

  } catch (err) {
    console.error('Compression failed:', err);
    // Fall back to original if compression fails
    uploadedFile = file;
    dropEl.querySelector('p').textContent = '✓ ' + file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
      previewEl.innerHTML = `<img class="preview-thumb" src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  }
}

async function uploadImage(file) {
  if (!file || !IS_CONFIGURED) return null;

  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const { data, error } = await db.storage
    .from('memories')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return data.path;
}


// ═══════════════════════════════════════
//  Save Memory
// ═══════════════════════════════════════

async function saveMemory() {
  const title = document.getElementById('f-title').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const author = document.getElementById('f-author').value.trim();
  const dateText = document.getElementById('f-date').value.trim();

  if (!title || !desc) {
    showToast('Please add a title and description', true);
    return;
  }
  if (!clickLat || !clickLng) {
    showToast('Please set a location — click the map or use GPS', true);
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>Saving...';

  try {
    let imagePath = null;
    if (uploadedFile) {
      imagePath = await uploadImage(uploadedFile);
    }

    const record = {
      lat: clickLat,
      lng: clickLng,
      title: title,
      description: desc,
      author_name: author || 'Anonymous',
      category: selectedCat || 'personal',
      date_text: dateText || null,
      image_path: imagePath,
      is_official: false,
      links: gatherLinks(),
    };

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
    await loadMemories();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save — ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Save Memory';
  }
}


// ═══════════════════════════════════════
//  Save Official Point
// ═══════════════════════════════════════

async function saveOfficial() {
  const title = document.getElementById('f-title').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const officialType = document.getElementById('f-officialtype').value;
  const icon = document.getElementById('f-icon').value.trim();

  if (!title || !desc) {
    showToast('Please add a name and description', true);
    return;
  }
  if (!clickLat || !clickLng) {
    showToast('Please set a location — click the map or use GPS', true);
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>Saving...';

  try {
    let imagePath = null;
    if (uploadedFile) {
      imagePath = await uploadImage(uploadedFile);
    }

    const record = {
      lat: clickLat,
      lng: clickLng,
      title: title,
      description: desc,
      author_name: 'Hampshire College',
      category: 'academic',
      is_official: true,
      official_type: officialType,
      icon: icon || '📍',
      image_path: imagePath,
      links: gatherLinks(),
    };

    if (IS_CONFIGURED) {
      const { error } = await db.from('memories').insert([record]);
      if (error) {
        console.warn('Admin insert blocked by RLS. Inserting as user memory.');
        record.is_official = false;
        const { error: e2 } = await db.from('memories').insert([record]);
        if (e2) throw e2;
        showToast('Saved! Mark as official in the Supabase dashboard.');
      } else {
        showToast('Official point saved!');
      }
    } else {
      record.id = 'local-' + Date.now();
      allMemories.push(record);
      showToast('Official point saved (demo mode)');
    }

    closeSidebar();
    exitAddMode();
    await loadMemories();
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save — ' + err.message, true);
    btn.disabled = false;
    btn.textContent = 'Save Official Point';
  }
}


// ═══════════════════════════════════════
//  Toast
// ═══════════════════════════════════════

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = isError ? 'show error' : 'show';
  setTimeout(() => { toast.className = ''; }, 3000);
}


// ═══════════════════════════════════════
//  Drag & Drop
// ═══════════════════════════════════════

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


// ═══════════════════════════════════════
//  Boot
// ═══════════════════════════════════════

loadMemories();
