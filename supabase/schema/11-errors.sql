-- Recorded failures
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Server-side failures, grouped.
--
-- A broken endpoint produces the same error a thousand times; a thousand
-- identical rows is not more information than one row and a count.
-- ---------------------------------------------------------------------------
create table if not exists errors (
  fingerprint text primary key,
  where_at    text        not null,
  message     text        not null,
  detail      text,
  count       integer     not null default 1,
  last_at     timestamptz not null default now()
);

alter table errors enable row level security;

create or replace function record_error(
  p_fingerprint text, p_where text, p_message text, p_detail text
) returns void language sql as $$
  insert into errors (fingerprint, where_at, message, detail)
  values (p_fingerprint, p_where, p_message, p_detail)
  on conflict (fingerprint) do update
     set count = errors.count + 1,
         last_at = now(),
         detail = coalesce(excluded.detail, errors.detail);
$$;
