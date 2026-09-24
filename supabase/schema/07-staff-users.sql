-- Staff accounts
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Staff accounts.
--
-- One row per person rather than one password everyone shares, so a sign-in
-- is attributable and removing someone does not mean changing a password for
-- everybody else. password_hash is scrypt - see src/lib/staff/password.ts.
-- ---------------------------------------------------------------------------
create table if not exists staff_users (
  username      text primary key,
  password_hash text        not null,
  role          text        not null default 'staff' check (role in ('admin', 'staff')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- For a table created before roles existed.
alter table staff_users add column if not exists role text not null default 'staff';

-- Read and written only by the server, which holds the service role key.
alter table staff_users enable row level security;
