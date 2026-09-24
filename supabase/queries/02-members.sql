-- The membership list, as booking sees it.
--
-- This is the list a member is checked against when they book. Two things
-- have to be right or they get charged for a class they already pay for:
-- the number and the phone.
--
-- Reads only.

select
  member_no                                   as number,
  name,
  phone,
  case when ended_at is null then 'live' else 'lapsed' end as status,
  created_at::date                            as added,
  -- Two memberships on one phone is a Couples & Friends plan, not a mistake.
  -- But a member with no number on a shared phone cannot prove who they are:
  -- the lookup finds two and asks for a number they do not have.
  case
    when member_no is null
     and count(*) over (partition by phone) > 1
    then 'CANNOT BOOK - shares a phone and has no number'
  end                                         as problem
from public.members
order by ended_at nulls first, name;
