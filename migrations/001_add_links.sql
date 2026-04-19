-- ═══════════════════════════════════════════════════════════
--  Migration: Add links column to memories table
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Add a JSONB column to store up to 3 links as:
--   [{"label": "Article", "url": "https://..."}, ...]
alter table public.memories
  add column if not exists links jsonb;

-- Update the Sander's Stop seed with links
update public.memories
  set links = '[
    {"label": "Dedication Article", "url": "https://www.hampshire.edu/news/friends-alum-sander-thoenes-slain-journalist-dedicate-memorial-inspire-world-citizens"},
    {"label": "Memorial Site", "url": "http://www.memorialforsander.org"}
  ]'::jsonb
  where title = 'Sander''s Stop' and is_official = true;
