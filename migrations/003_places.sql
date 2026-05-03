-- ═══════════════════════════════════════════════════════════
--  Migration: places table — admin-curated campus content
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
--
--  Splits admin-curated points (memorials, public art, named
--  locations, buildings, trees…) out of the memories table.
--  After this migration:
--    - memories is purely user-generated personal stories
--    - places holds everything admins curate
--    - Sander's Stop is re-seeded into places
-- ═══════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────┐
-- │  1. PLACES TABLE                    │
-- └─────────────────────────────────────┘

create table if not exists public.places (
  id            uuid default gen_random_uuid() primary key,
  created_at    timestamptz default now() not null,
  created_by    uuid references auth.users(id) on delete set null,

  -- Location
  lat           double precision not null,
  lng           double precision not null,
  location      geography(Point, 4326) generated always as (
                  st_setsrid(st_makepoint(lng, lat), 4326)::geography
                ) stored,

  -- Two-level taxonomy.
  --   layer = which UI toggle this lives under
  --   kind  = finer subtype that drives icon / color
  layer         text not null
                check (layer in ('landmarks','wayfinding','trees')),
  kind          text not null
                check (kind in (
                  'memorial','public_art','named_location','cultural','nature',
                  'building','housing',
                  'tree'
                )),

  -- Display
  name          text not null,
  description   text,
  icon          text,                          -- emoji marker glyph
  image_path    text,
  links         jsonb,

  -- Per-kind extension fields. Keep loose so we don't migrate every
  -- time we want to capture a new attribute (artist, species, year…).
  details       jsonb default '{}'::jsonb not null,

  -- Soft hide (admins can take a place down without deleting it)
  visible       boolean default true not null
);

create index if not exists places_location_idx  on public.places using gist (location);
create index if not exists places_layer_idx     on public.places (layer);
create index if not exists places_kind_idx      on public.places (kind);
create index if not exists places_visible_idx   on public.places (visible);

alter table public.places enable row level security;


-- ┌─────────────────────────────────────┐
-- │  2. RLS                             │
-- └─────────────────────────────────────┘

drop policy if exists "Anyone can read visible places"  on public.places;
drop policy if exists "Admins can insert places"        on public.places;
drop policy if exists "Admins can update places"        on public.places;
drop policy if exists "Admins can delete places"        on public.places;

-- Public read of visible places (no profile join required — these
-- are admin-curated, so an "active author" check doesn't apply).
create policy "Anyone can read visible places"
  on public.places for select
  using (visible = true);

create policy "Admins can insert places"
  on public.places for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Admins can update places"
  on public.places for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete places"
  on public.places for delete
  to authenticated
  using (public.is_admin(auth.uid()));


-- ┌─────────────────────────────────────┐
-- │  3. CLEAN UP MEMORIES TABLE         │
-- └─────────────────────────────────────┘
--
-- These columns belonged to the old "official memories" idea and
-- are no longer used by anything in the app.
--
-- We have to drop policies that reference is_official BEFORE the
-- column drop. Some of these may have been hand-created in the
-- Supabase dashboard ("Users can update own memories", "Users can
-- delete own memories") — they're recreated below without the
-- is_official reference so the user-edits-own-content behavior
-- they were enabling still works.

drop policy if exists "Active users can insert their own memories" on public.memories;
drop policy if exists "Users can update own memories"              on public.memories;
drop policy if exists "Users can delete own memories"              on public.memories;

alter table public.memories drop column if exists is_official;
alter table public.memories drop column if exists official_type;
alter table public.memories drop column if exists icon;

-- The old memories_official_idx was on is_official; gone with the column.
drop index if exists public.memories_official_idx;

-- Recreate the insert policy without the is_official check (column is gone now).
create policy "Active users can insert their own memories"
  on public.memories for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active(auth.uid())
  );

-- Let users edit / delete their own memories (replaces the hand-created
-- policies that referenced is_official).
create policy "Users can update own memories"
  on public.memories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own memories"
  on public.memories for delete
  to authenticated
  using (user_id = auth.uid());


-- ┌─────────────────────────────────────┐
-- │  4. RE-SEED: Sander's Stop          │
-- └─────────────────────────────────────┘
--
-- Originally seeded into memories as is_official=true; lives in
-- places now under landmarks / memorial.

insert into public.places (
  name, description, lat, lng,
  layer, kind, icon,
  links, details
) values (
  'Sander''s Stop',
  'Campus bus shelter dedicated in September 2016 to the memory of Sander Thoenes (Hampshire ''91), a Dutch journalist who was murdered by Indonesian soldiers in September 1999 while reporting on the East Timor independence vote for the Financial Times. His friends and former professors funded the memorial at the spot where Thoenes frequently caught the PVTA bus to Five College classes. The plaque reads: "Whatever journey you are about to take, you have the power to make it count." A companion scholarship fund has supported Hampshire students pursuing journalism, human rights, and peace-building for over 15 years. UN Secretary-General Kofi Annan said of Thoenes: "It is largely thanks to the courage and determination of men and women like him that crimes against humanity are brought to the attention of the world''s conscience."',
  42.32615073147959,
  -72.53028911100283,
  'landmarks',
  'memorial',
  '🕊',
  '[
    {"label": "Dedication Article", "url": "https://www.hampshire.edu/news/friends-alum-sander-thoenes-slain-journalist-dedicate-memorial-inspire-world-citizens"},
    {"label": "Memorial Site", "url": "http://www.memorialforsander.org"}
  ]'::jsonb,
  jsonb_build_object(
    'honoree', 'Sander Thoenes',
    'class_year', '1991',
    'dedicated_year', 2016
  )
)
on conflict do nothing;
