-- What has gone wrong on the server, grouped.
--
-- A broken endpoint produces the same failure a thousand times, so these are
-- grouped with a count rather than listed one by one. Anything here was a
-- real person hitting a real error, whether or not they told you.
--
-- Reads only.

select
  last_at                                     as last_seen,
  count                                       as times,
  where_at                                    as happened_in,
  message,
  detail
from public.errors
order by last_at desc;
