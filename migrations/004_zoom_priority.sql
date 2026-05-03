-- ═══════════════════════════════════════════════════════════
--  Migration: zoom-range visibility + label priority on places
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
--
--  Adds:
--   - min_zoom / max_zoom — when set, hide the place outside that
--     zoom range. Used to do hierarchical labels (e.g. show
--     "Merrill" until zoom 16, then show Merrill A/B/C from 17).
--   - label_priority — integer tiebreaker for the collision pass.
--     Higher = wins more collisions. Defaults to 0 (Normal).
-- ═══════════════════════════════════════════════════════════

alter table public.places
  add column if not exists min_zoom int,
  add column if not exists max_zoom int,
  add column if not exists label_priority int not null default 0;

-- Sanity ranges so a typo doesn't black-hole a place.
alter table public.places
  drop constraint if exists places_min_zoom_check,
  drop constraint if exists places_max_zoom_check;
alter table public.places
  add constraint places_min_zoom_check
    check (min_zoom is null or min_zoom between 0 and 22),
  add constraint places_max_zoom_check
    check (max_zoom is null or max_zoom between 0 and 22);
