-- Taking and restoring a place
--
-- Part of the schema. See supabase/README.md.

-- Take a place, or report why not.
--
-- The advisory lock is what stops two people both taking the last place: it
-- serialises everyone booking the same class on the same date for the length
-- of the transaction.
drop function if exists public.book_session(text, date, text, text, int);

create or replace function public.book_session(
  p_session_id text,
  p_date       date,
  p_name       text,
  p_phone      text,
  p_capacity   int,
  p_member_id  uuid default null,
  p_payment    text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  taken   int;
  v_token text;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id || '|' || p_date::text));

  select count(*) into taken
    from public.bookings
   where session_id = p_session_id
     and class_date = p_date
     and cancelled_at is null;

  if taken >= p_capacity then
    return json_build_object('ok', false, 'reason', 'full', 'spots_left', 0);
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.bookings
    (session_id, class_date, name, phone, token, member_id, payment)
  values
    (p_session_id, p_date, p_name, p_phone, v_token, p_member_id, p_payment);

  return json_build_object(
    'ok', true,
    'spots_left', p_capacity - taken - 1,
    'token', v_token
  );
exception
  when unique_violation then
    return json_build_object('ok', false, 'reason', 'duplicate');
end;
$$;

-- Undo a cancellation, if the class has not filled up since.
create or replace function public.restore_booking(
  p_id       uuid,
  p_capacity int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row_session text;
  row_date    date;
  taken       int;
begin
  select session_id, class_date into row_session, row_date
    from public.bookings
   where id = p_id and cancelled_at is not null;

  if row_session is null then
    return json_build_object('ok', false, 'reason', 'not-found');
  end if;

  perform pg_advisory_xact_lock(hashtext(row_session || '|' || row_date::text));

  select count(*) into taken
    from public.bookings
   where session_id = row_session and class_date = row_date and cancelled_at is null;

  if taken >= p_capacity then
    return json_build_object('ok', false, 'reason', 'full');
  end if;

  update public.bookings set cancelled_at = null where id = p_id;
  return json_build_object('ok', true);
exception
  when unique_violation then
    -- Someone rebooked with the same number while it was cancelled.
    return json_build_object('ok', false, 'reason', 'full');
end;
$$;
