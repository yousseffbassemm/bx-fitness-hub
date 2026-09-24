-- People who asked to be contacted and have not been.
--
-- These come from the "Start here" form. Nothing emails them yet, so this
-- list is the only thing standing between an enquiry and being forgotten.
--
-- Reads only.

select
  created_at                                  as asked_at,
  name,
  phone,
  email,
  goal,
  age(now(), created_at)                      as waiting_for
from public.leads
where handled_at is null
order by created_at;
