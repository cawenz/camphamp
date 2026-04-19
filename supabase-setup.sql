-- ═══════════════════════════════════════════════════════════════
--  Hampshire Memories — Supabase Setup
--  Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────┐
-- │  1. ENABLE EXTENSIONS               │
-- └─────────────────────────────────────┘

-- PostGIS for spatial queries (find memories near a point, etc.)
create extension if not exists postgis;


-- ┌─────────────────────────────────────┐
-- │  2. MEMORIES TABLE                  │
-- └─────────────────────────────────────┘

create table public.memories (
  id            uuid default gen_random_uuid() primary key,
  created_at    timestamptz default now() not null,

  -- Location
  lat           double precision not null,
  lng           double precision not null,
  location      geography(Point, 4326) generated always as (
                  st_setsrid(st_makepoint(lng, lat), 4326)::geography
                ) stored,

  -- Content
  title         text not null,
  description   text not null,
  author_name   text not null default 'Anonymous',
  category      text not null default 'personal'
                check (category in ('personal','academic','social','nature','art')),
  date_text     text,                          -- freeform, e.g. "Spring 2018"

  -- Media (paths in Supabase Storage)
  image_path    text,                          -- e.g. "memories/abc123.jpg"

  -- Admin layer vs user layer
  is_official   boolean default false not null,
  official_type text                           -- 'building','cultural','art','nature','memorial','housing'
                check (official_type is null or
                       official_type in ('building','cultural','art','nature','memorial','housing')),
  icon          text,                          -- emoji for official markers

  -- Moderation
  approved      boolean default true not null  -- flip to false if you want moderation queue
);

-- Spatial index for geo queries
create index memories_location_idx on public.memories using gist (location);

-- Index for filtering layers
create index memories_official_idx on public.memories (is_official);


-- ┌─────────────────────────────────────┐
-- │  3. ROW LEVEL SECURITY (RLS)        │
-- └─────────────────────────────────────┘

alter table public.memories enable row level security;

-- Anyone can READ approved memories
create policy "Anyone can read approved memories"
  on public.memories for select
  using (approved = true);

-- Anyone can INSERT non-official memories (user submissions)
-- (they cannot set is_official = true via the anon key)
create policy "Anyone can submit memories"
  on public.memories for insert
  with check (is_official = false);

-- Only authenticated users with admin role can insert official points
-- (you'll use the service_role key or a custom claim for this)
create policy "Admins can insert official points"
  on public.memories for insert
  to authenticated
  with check (
    is_official = true
    and auth.jwt() ->> 'user_role' = 'admin'
  );

-- Only admins can update/delete
create policy "Admins can update memories"
  on public.memories for update
  to authenticated
  using (auth.jwt() ->> 'user_role' = 'admin');

create policy "Admins can delete memories"
  on public.memories for delete
  to authenticated
  using (auth.jwt() ->> 'user_role' = 'admin');


-- ┌─────────────────────────────────────┐
-- │  4. STORAGE BUCKET                  │
-- └─────────────────────────────────────┘

-- Create a public bucket for memory images
-- (Run this or create the bucket via Dashboard → Storage → New Bucket)
insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

-- Allow anyone to upload to the memories bucket (max 5MB images)
create policy "Anyone can upload memory images"
  on storage.objects for insert
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = 'uploads'
  );

-- Allow anyone to read from the memories bucket
create policy "Anyone can view memory images"
  on storage.objects for select
  using (bucket_id = 'memories');


-- ┌─────────────────────────────────────┐
-- │  5. HELPER FUNCTION: Nearby query   │
-- └─────────────────────────────────────┘

-- Find memories within a radius (meters) of a point
create or replace function public.memories_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision default 500
)
returns setof public.memories
language sql
stable
as $$
  select *
  from public.memories
  where approved = true
    and st_dwithin(
          location,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
        )
  order by location <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
$$;


-- ┌─────────────────────────────────────┐
-- │  6. SEED: Sample official point     │
-- └─────────────────────────────────────┘

insert into public.memories (
  title, description, lat, lng,
  is_official, official_type, icon,
  approved, author_name, category
) values (
  'Sander''s Stop',
  'Campus bus shelter dedicated in September 2016 to the memory of Sander Thoenes (Hampshire ''91), a Dutch journalist who was murdered by Indonesian soldiers in September 1999 while reporting on the East Timor independence vote for the Financial Times. His friends and former professors funded the memorial at the spot where Thoenes frequently caught the PVTA bus to Five College classes. The plaque reads: "Whatever journey you are about to take, you have the power to make it count." A companion scholarship fund has supported Hampshire students pursuing journalism, human rights, and peace-building for over 15 years. UN Secretary-General Kofi Annan said of Thoenes: "It is largely thanks to the courage and determination of men and women like him that crimes against humanity are brought to the attention of the world''s conscience."',
  42.32615073147959,
  -72.53028911100283,
  true,
  'memorial',
  '🕊',
  true,
  'Hampshire College',
  'personal'
);
