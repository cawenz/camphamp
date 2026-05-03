// ═══════════════════════════════════════════════════════════
//  Shared auth helpers (used by app.js, signup.html,
//  login.html, admin.html). Loads after config.js.
// ═══════════════════════════════════════════════════════════

(function () {
  const cfg = (typeof CAMPHAMP_CONFIG !== 'undefined') ? CAMPHAMP_CONFIG : {};
  const url = cfg.SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const key = cfg.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
  const configured = url !== 'YOUR_SUPABASE_URL';

  const db = configured ? window.supabase.createClient(url, key) : null;

  async function getSession() {
    if (!db) return null;
    const { data } = await db.auth.getSession();
    return data?.session || null;
  }

  // Returns the current user's profile row, or null.
  // Caches in module-level var; pass refresh=true to bypass.
  let _profileCache = undefined;
  async function getProfile(refresh = false) {
    if (!db) return null;
    if (!refresh && _profileCache !== undefined) return _profileCache;

    const session = await getSession();
    if (!session) { _profileCache = null; return null; }

    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) { console.error('getProfile error', error); _profileCache = null; return null; }
    _profileCache = data || null;
    return _profileCache;
  }

  function clearProfileCache() { _profileCache = undefined; }

  async function signOut() {
    if (!db) return;
    await db.auth.signOut();
    clearProfileCache();
  }

  // Hampshire-style badge from a profile row.
  //   alum / current_student      → F02, S02
  //   parent                      → P02
  //   faculty                     → Faculty '10–present  /  Faculty '10–'18
  //   staff                       → Staff '10–present    /  Staff '10–'18
  //   other                       → "Community" (or affiliation_other if set)
  function formatBadge(p) {
    if (!p) return '';
    const yy = (y) => (y == null) ? '' : String(y).slice(-2).padStart(2, '0');
    const seasonLetter = (s) => s === 'Spring' ? 'S' : 'F';

    switch (p.affiliation) {
      case 'alum':
      case 'current_student':
        if (p.start_year && p.start_season) return seasonLetter(p.start_season) + yy(p.start_year);
        return p.affiliation === 'alum' ? 'Alum' : 'Student';
      case 'parent':
        return p.start_year ? 'P' + yy(p.start_year) : 'Parent';
      case 'faculty':
      case 'staff': {
        const word = p.affiliation === 'faculty' ? 'Faculty' : 'Staff';
        if (!p.start_year) return word;
        const end = p.end_year ? `'${yy(p.end_year)}` : 'present';
        return `${word} '${yy(p.start_year)}–${end}`;
      }
      case 'other':
        return p.affiliation_other?.trim() || 'Community';
      default:
        return '';
    }
  }

  // Long human-readable summary for admin row.
  function formatAffiliation(p) {
    if (!p) return '';
    const season = p.start_season ? `${p.start_season} ` : '';
    switch (p.affiliation) {
      case 'alum':
        return `Alum (started ${season}${p.start_year ?? '—'})`;
      case 'current_student':
        return `Current student (started ${season}${p.start_year ?? '—'})`;
      case 'parent':
        return `Parent (child started ${p.start_year ?? '—'})`;
      case 'faculty':
      case 'staff': {
        const word = p.affiliation === 'faculty' ? 'Faculty' : 'Staff';
        const end = p.end_year ? p.end_year : 'present';
        return `${word} (${p.start_year ?? '—'}–${end})`;
      }
      case 'other':
        return `Other: ${p.affiliation_other || '—'}`;
      default:
        return p.affiliation || '';
    }
  }

  window.CampHampAuth = {
    db,
    isConfigured: configured,
    getSession,
    getProfile,
    clearProfileCache,
    signOut,
    formatBadge,
    formatAffiliation,
  };
})();
