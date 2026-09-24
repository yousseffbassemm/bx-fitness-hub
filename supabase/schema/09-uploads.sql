-- Uploaded images
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Uploaded images.
--
-- Stored as base64 text rather than bytea: PostgREST speaks JSON, and bytea
-- has no clean representation in it. The id is a content hash, so the same
-- file uploaded twice is one row and the URL can be cached indefinitely.
-- ---------------------------------------------------------------------------
create table if not exists uploads (
  id         text primary key,
  mime       text        not null,
  bytes_b64  text        not null,
  created_at timestamptz not null default now()
);

alter table uploads enable row level security;
