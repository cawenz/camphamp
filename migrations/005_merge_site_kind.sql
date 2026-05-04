-- ═══════════════════════════════════════════════════════════
--  Migration: collapse 'cultural', 'nature', 'named_location'
--  into a single 'site' kind under the Landmarks layer.
--  Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════
--
--  Rationale: in practice these three kinds blurred together
--  (a "named location" was usually "cultural"; a "nature spot"
--  was often a "named location"). Curators were forced to make
--  a meaningless choice. One generic kind keeps the per-place
--  emoji override available for cases that warrant a custom icon.
-- ═══════════════════════════════════════════════════════════


-- 1. Drop the existing kind check (auto-generated name from inline check).
--    The constraint may also be named slightly differently if someone
--    recreated it by hand — the loop catches anything referencing 'kind'.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.places'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute 'alter table public.places drop constraint ' || quote_ident(c);
  end loop;
end$$;


-- 2. Migrate existing rows.
update public.places
   set kind = 'site'
 where kind in ('cultural', 'nature', 'named_location');


-- 3. Add the new constraint with the simplified set of kinds.
alter table public.places
  add constraint places_kind_check
    check (kind in (
      'memorial', 'public_art', 'site',
      'building', 'housing',
      'tree'
    ));
