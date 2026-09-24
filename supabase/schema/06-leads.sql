-- Enquiries
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Enquiries from the "Start here" form.
--
-- No unique constraint: the same person asking twice is two enquiries, and
-- dropping the second because it resembles the first is the exact failure
-- this table exists to end.
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id         bigint generated always as identity primary key,
  name       text        not null,
  phone      text        not null,
  email      text        not null,
  goal       text        not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists leads_created_idx on leads (created_at desc);

-- Read and written only by the server, which holds the service role key.
alter table leads enable row level security;
