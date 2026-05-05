-- ═══════════════════════════════════════════════════════════
--  Migration: multi-photo galleries for places
--  Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════
--
--  Adds `image_paths` (jsonb array of {path, caption?}) to places.
--  The legacy `image_path` column stays for backward compat for now,
--  but new code reads/writes `image_paths` exclusively. First entry
--  in the array is the primary photo shown on the marker detail card.
-- ═══════════════════════════════════════════════════════════

alter table public.places
  add column if not exists image_paths jsonb default '[]'::jsonb not null;

-- Migrate any existing single-photo places into the array shape.
update public.places
   set image_paths = jsonb_build_array(jsonb_build_object('path', image_path))
 where image_path is not null
   and (image_paths is null or jsonb_array_length(image_paths) = 0);

-- (We leave image_path in place — frontend will stop writing to it but
--  reads still fall back to it for any rows the migration missed.)
