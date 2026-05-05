// ═══════════════════════════════════════════════════════════
//  Place icons — inline SVGs, Lucide-style line icons.
//
//  All icons are 24x24, fill="none", stroke="currentColor", so
//  they pick up color from CSS. Keep them line-only / monochrome.
//  To override an icon for a single place, set place.icon to an
//  emoji on that row.
// ═══════════════════════════════════════════════════════════

const ICONS = {
  // memorial — flame / candle
  memorial: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  `,

  // public_art — palette
  public_art: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13.5" cy="6.5" r="0.6"/>
      <circle cx="17.5" cy="10.5" r="0.6"/>
      <circle cx="8.5" cy="7.5" r="0.6"/>
      <circle cx="6.5" cy="12.5" r="0.6"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.43-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.66h1.99c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2Z"/>
    </svg>
  `,

  // site — map-pin (catch-all "this is a place" landmark)
  site: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  `,

  // building — building with windows
  building: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  `,

  // housing — peaked-roof house
  housing: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
      <path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
    </svg>
  `,

  // tree — round canopy + trunk
  tree: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/>
      <path d="M12 19v3"/>
    </svg>
  `,

  // ────────────────────────────────────────────────
  //  Picker icons — useful overrides for places.
  //  Curated for a campus map. All Lucide-style.
  // ────────────────────────────────────────────────

  library: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>
    </svg>
  `,

  flask: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2v7.31"/>
      <path d="M14 9.3V1.99"/>
      <path d="M8.5 2h7"/>
      <path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>
      <path d="M5.52 16h12.96"/>
    </svg>
  `,

  drama: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 11h.01"/>
      <path d="M14 6h.01"/>
      <path d="M18 6h.01"/>
      <path d="M6.5 13.1h.01"/>
      <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/>
      <path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/>
      <path d="M14 11c-1.5 4.4-5.4 7-9 6-1.7-.5-3-2-3-4 0-7 6-9 7-9 .9 0 1 .5 1 1"/>
      <path d="M10.1 15.9c-.8.8-2 .8-2.8 0"/>
    </svg>
  `,

  utensils: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  `,

  coffee: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2v2"/>
      <path d="M14 2v2"/>
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>
      <path d="M6 2v2"/>
    </svg>
  `,

  bed: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4v16"/>
      <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
      <path d="M2 17h20"/>
      <path d="M6 8v9"/>
    </svg>
  `,

  trophy: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  `,

  tennis: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="9" cy="10" rx="6" ry="7"/>
      <path d="M9 5v10"/>
      <path d="M3 10h12"/>
      <path d="M14 15.5l5 5"/>
      <path d="M18.5 19.5l1.4 1.4a1 1 0 0 0 1.4 0l.2-.2a1 1 0 0 0 0-1.4l-1.4-1.4"/>
    </svg>
  `,

  flower: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5"/>
      <path d="M12 7.5A4.5 4.5 0 1 0 7.5 12"/>
      <path d="M12 7.5V9"/>
      <path d="M7.5 12H9"/>
      <path d="M16.5 12H15"/>
      <path d="M12 16.5V15"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="m8 16 1.5-1.5"/>
      <path d="M14.5 9.5 16 8"/>
      <path d="m8 8 1.5 1.5"/>
      <path d="M14.5 14.5 16 16"/>
    </svg>
  `,

  'graduation-cap': `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
      <path d="M22 10v6"/>
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
    </svg>
  `,

  music: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  `,

  // dance — custom: stylised figure with one arm raised
  dance: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="4.5" r="2"/>
      <path d="M12 6.5v6"/>
      <path d="M12 7l-4 3"/>
      <path d="M12 7l5-2.5"/>
      <path d="M12 12.5l-3 5"/>
      <path d="M12 12.5l4 4"/>
      <path d="M9 17.5l-1 4"/>
      <path d="M16 16.5l1.5 4"/>
    </svg>
  `,

  camera: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  `,

  tractor: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 4h9l1 7h2"/>
      <path d="M14 4h-2"/>
      <path d="M3 4v9"/>
      <circle cx="6" cy="17" r="3"/>
      <circle cx="17" cy="16" r="4"/>
      <path d="M14 8h6l1 4h-2"/>
    </svg>
  `,

  bicycle: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5"/>
      <circle cx="18.5" cy="17.5" r="3.5"/>
      <path d="M15 6h4l-3 9"/>
      <path d="M5 17l5-9 4 9"/>
      <path d="M10 8h-3"/>
    </svg>
  `,

  parking: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
    </svg>
  `,

  bus: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M15 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2L21 8.5c-.4-1.5-1.7-2.5-3.2-2.5H5.6C3.6 6 2 7.6 2 9.6V18h3"/>
      <circle cx="7" cy="18" r="2"/>
      <path d="M9 18h5"/>
      <circle cx="16" cy="18" r="2"/>
    </svg>
  `,

  mail: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  `,

  // ────────────────────────────────────────────────
  //  Institution-specific icons (Five-College area)
  // ────────────────────────────────────────────────

  // Eric Carle Museum — caterpillar (4 segments + antennae + eye)
  caterpillar: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="4.5" cy="15" r="2.6"/>
      <circle cx="9.5" cy="15" r="2.6"/>
      <circle cx="14.5" cy="15" r="2.6"/>
      <circle cx="19.5" cy="15" r="2.6"/>
      <path d="M18.5 12.6 L17.7 9.6"/>
      <path d="M20.5 12.6 L21.3 9.6"/>
      <circle cx="20.2" cy="14.5" r="0.55" fill="currentColor"/>
    </svg>
  `,

  // Hitchcock Center — salamander (long body + 4 legs + curled tail)
  salamander: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="10" cy="13" rx="8" ry="2.6"/>
      <path d="M18 13 c 3.5 0 4 -3.5 1.5 -3.5 c -1.2 0 -1.6 1.4 -0.4 1.7"/>
      <path d="M5 15.4 v2.6"/>
      <path d="M9 15.4 v2.6"/>
      <path d="M13 15.4 v2.6"/>
      <path d="M16 15.2 v2.6"/>
      <circle cx="3.2" cy="12.4" r="0.5" fill="currentColor"/>
    </svg>
  `,

  // Yiddish Book Center — goat (body + horns + beard + 4 legs)
  goat: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 13 h12"/>
      <path d="M3 17 h12"/>
      <path d="M3 13 v4"/>
      <path d="M15 12.5 l 4 -1.5 v 7 l-4-1.5 z"/>
      <path d="M16 11 l-1.2 -3"/>
      <path d="M18 10.6 l 0.8 -3"/>
      <circle cx="17.5" cy="13.2" r="0.45" fill="currentColor"/>
      <path d="M18 16.4 v 2.4"/>
      <path d="M5 17 v3"/>
      <path d="M8 17 v3"/>
      <path d="M11 17 v3"/>
      <path d="M14 17 v3"/>
    </svg>
  `,
};

// Ordered list shown in the place form's icon picker. Includes both the
// kind defaults and the curated additions, so curators can also pick e.g.
// the map-pin "site" icon for a wayfinding place when it fits.
const PICKER_ICONS = [
  { key: 'memorial',         label: 'Flame' },
  { key: 'public_art',       label: 'Palette' },
  { key: 'site',             label: 'Map pin' },
  { key: 'building',         label: 'Building' },
  { key: 'housing',          label: 'House (dorm)' },
  { key: 'tree',             label: 'Tree' },
  { key: 'library',          label: 'Library' },
  { key: 'flask',            label: 'Science' },
  { key: 'drama',            label: 'Theater' },
  { key: 'music',            label: 'Music' },
  { key: 'dance',            label: 'Dance' },
  { key: 'camera',           label: 'Camera' },
  { key: 'utensils',         label: 'Dining hall' },
  { key: 'coffee',           label: 'Cafe' },
  { key: 'bed',              label: 'Dorm' },
  { key: 'trophy',           label: 'Athletics' },
  { key: 'tennis',           label: 'Tennis / pickleball' },
  { key: 'flower',           label: 'Garden' },
  { key: 'graduation-cap',   label: 'Academic' },
  { key: 'tractor',          label: 'Farm / barn' },
  { key: 'bicycle',          label: 'Bicycle' },
  { key: 'bus',              label: 'Bus' },
  { key: 'parking',          label: 'Parking' },
  { key: 'mail',             label: 'Mail' },
  // Institution-specific
  { key: 'caterpillar',      label: 'Caterpillar (Eric Carle)' },
  { key: 'salamander',       label: 'Salamander (Hitchcock)' },
  { key: 'goat',             label: 'Goat (Yiddish Book Center)' },
];

window.ICONS = ICONS;
window.PICKER_ICONS = PICKER_ICONS;
