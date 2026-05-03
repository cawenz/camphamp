-- ═══════════════════════════════════════════════════════════
--  Migration: User accounts, profiles, admin moderation
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════
--
--  Adds:
--   - profiles table (one row per auth.users, holds affiliation answers)
--   - auto-create profile trigger on signup
--   - role/status helpers used by RLS
--   - user_id on memories, with RLS rewritten to require auth
--   - hides memories whose author is disabled
--
--  After running this, sign up through the app, then run the
--  bootstrap snippet at the bottom of this file (once) to make
--  yourself an admin.
-- ═══════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────┐
-- │  1. PROFILES TABLE                  │
-- └─────────────────────────────────────┘

create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz default now() not null,
  email               text,
  display_name        text not null,

  status              text not null default 'active'
                      check (status in ('active','disabled')),
  role                text not null default 'user'
                      check (role in ('user','admin')),

  -- Signup questionnaire answers
  affiliation         text not null
                      check (affiliation in
                        ('alum','current_student','parent','faculty','staff','other')),

  -- Year (4-digit) and season for student / alum / parent's child.
  -- Faculty/staff use start_year only (season ignored).
  start_year          int
                      check (start_year is null or (start_year between 1965 and 2100)),
  start_season        text
                      check (start_season is null or start_season in ('Fall','Spring')),

  -- Faculty/staff only. NULL end_year = present.
  end_year            int
                      check (end_year is null or (end_year between 1965 and 2100)),

  -- Free text for affiliation = 'other'
  affiliation_other   text,

  why_joining         text,

  -- Disabled-account audit
  disabled_at         timestamptz,
  disabled_by         uuid references auth.users(id) on delete set null,
  disabled_reason     text
);

create index if not exists profiles_status_idx       on public.profiles (status);
create index if not exists profiles_created_at_idx   on public.profiles (created_at desc);

alter table public.profiles enable row level security;


-- ┌─────────────────────────────────────┐
-- │  2. ROLE / STATUS HELPERS           │
-- └─────────────────────────────────────┘

-- security definer so callers can check role without needing to read profiles directly
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and status = 'active'
  );
$$;


-- ┌─────────────────────────────────────┐
-- │  3. PROFILE RLS                     │
-- └─────────────────────────────────────┘

drop policy if exists "Own profile readable"     on public.profiles;
drop policy if exists "Own profile updatable"    on public.profiles;
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins update any profile" on public.profiles;

-- A user can read their own profile.
create policy "Own profile readable"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- A user can update their own profile, but cannot change role/status.
create policy "Own profile updatable"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
  );

-- Admins can read all profiles.
create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- Admins can update any profile (including role/status).
create policy "Admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- ┌─────────────────────────────────────┐
-- │  4. AUTO-CREATE PROFILE ON SIGNUP   │
-- └─────────────────────────────────────┘
--
-- The signup form passes the questionnaire fields via the
-- `data` argument of supabase.auth.signUp({ options: { data } }),
-- which Supabase stores on auth.users.raw_user_meta_data.
-- We mirror those into the profiles row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, email, display_name,
    affiliation, start_year, start_season, end_year,
    affiliation_other, why_joining
  ) values (
    new.id,
    new.email,
    coalesce(nullif(meta->>'display_name',''), split_part(new.email,'@',1)),
    coalesce(meta->>'affiliation','other'),
    nullif(meta->>'start_year','')::int,
    nullif(meta->>'start_season',''),
    nullif(meta->>'end_year','')::int,
    nullif(meta->>'affiliation_other',''),
    nullif(meta->>'why_joining','')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ┌─────────────────────────────────────┐
-- │  5. MEMORIES: user_id + new RLS     │
-- └─────────────────────────────────────┘

alter table public.memories
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists memories_user_id_idx on public.memories (user_id);

-- Drop the old anonymous-friendly policies. The new world is:
--   read:   approved AND (no author OR author active)
--   insert: authenticated active user, user_id = self, never is_official
--   update/delete: admins only
--
-- Also drop any names we'll create below so the migration is re-runnable
-- and tolerant of policies created by hand in the Supabase dashboard.
drop policy if exists "Anyone can read approved memories"               on public.memories;
drop policy if exists "Anyone can submit memories"                      on public.memories;
drop policy if exists "Auth users can submit memories"                  on public.memories;
drop policy if exists "Admins can insert official points"               on public.memories;
drop policy if exists "Admins can update memories"                      on public.memories;
drop policy if exists "Admins can delete memories"                      on public.memories;
drop policy if exists "Read approved memories from active authors"      on public.memories;
drop policy if exists "Active users can insert their own memories"      on public.memories;
drop policy if exists "Admins can insert official memories"             on public.memories;

-- Public (anon + authenticated) can read approved memories whose author
-- is still active. Uses the security-definer helper so anon doesn't
-- need any privileges on the profiles table.
create policy "Read approved memories from active authors"
  on public.memories for select
  using (
    approved = true
    and (user_id is null or public.is_active(user_id))
  );

-- Make sure anonymous visitors can call the helper used in the policy.
grant execute on function public.is_active(uuid) to anon, authenticated;
grant execute on function public.is_admin(uuid)  to anon, authenticated;

create policy "Active users can insert their own memories"
  on public.memories for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_official = false
    and public.is_active(auth.uid())
  );

create policy "Admins can insert official memories"
  on public.memories for insert
  to authenticated
  with check (
    public.is_admin(auth.uid())
    and (user_id = auth.uid() or user_id is null)
  );

create policy "Admins can update memories"
  on public.memories for update
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can delete memories"
  on public.memories for delete
  to authenticated
  using (public.is_admin(auth.uid()));


-- ┌─────────────────────────────────────┐
-- │  6. STORAGE: require auth to upload │
-- └─────────────────────────────────────┘

drop policy if exists "Anyone can upload memory images"             on storage.objects;
drop policy if exists "Authenticated users can upload memory images" on storage.objects;

create policy "Authenticated users can upload memory images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = 'uploads'
    and public.is_active(auth.uid())
  );


-- ┌─────────────────────────────────────────────────────────┐
-- │  7. ADMIN BOOTSTRAP                                     │
-- │  Run ONCE after signing yourself up through the app.    │
-- │  Replace the email with your account.                   │
-- └─────────────────────────────────────────────────────────┘
--
-- update public.profiles
--   set role = 'admin'
--   where email = 'you@example.com';
