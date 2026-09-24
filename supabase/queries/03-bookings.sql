-- Who is coming, and who owes money.
--
-- The next fourteen days. A member's place is part of what they already pay
-- for; a guest pays at the desk, and `owes` is the column that matters at
-- seven o'clock.
--
-- Reads only.

select
  b.class_date                                as on_date,
  b.session_id                                as class,
  b.name,
  b.phone,
  case when b.member_id is null then 'guest' else 'member' end as who,
  m.member_no                                 as number,
  b.payment,
  case
    when b.member_id is not null then null          -- nothing to pay
    when b.paid_at is null       then 'OWES'
    else 'paid'
  end                                         as owes,
  case when b.promoted_at is not null then 'came off the waitlist' end as note
from public.bookings b
left join public.members m on m.id = b.member_id
where b.cancelled_at is null
  and b.class_date between current_date and current_date + 14
order by b.class_date, b.session_id, b.created_at;
