-- Editable site content
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Editable pieces of the site, as JSON under a key.
--
-- One table rather than one per section: prices, coaches and the timetable
-- differ only in shape. jsonb so the value is queryable if it ever needs to
-- be. edited_by and edited_at make a surprising change traceable.
-- ---------------------------------------------------------------------------
create table if not exists site_content (
  key       text primary key,
  value     jsonb       not null,
  edited_by text        not null,
  edited_at timestamptz not null default now()
);

alter table site_content enable row level security;
