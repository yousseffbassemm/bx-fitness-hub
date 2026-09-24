-- Extensions
--
-- Part of the schema. See supabase/README.md.

-- Only gen_random_uuid is used, and that is core Postgres since 13. Kept
-- because an older database may still need it; nothing here depends on it.
create extension if not exists pgcrypto;
