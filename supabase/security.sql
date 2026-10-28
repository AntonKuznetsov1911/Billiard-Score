-- "Твой бильярд" — защита от подбора кода клуба.
-- Выполните в Supabase: Dashboard -> SQL Editor -> New query -> Run
-- (после schema.sql / hardening.sql; повторный запуск безопасен).
--
-- Код приглашения — единственное, что защищает клуб. Без ограничения
-- вошедший пользователь мог бы перебирать коды через join_club_by_code
-- сколько угодно. Теперь не больше 10 неудачных попыток за 15 минут.

create table if not exists club_join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists club_join_attempts_user_time on club_join_attempts (user_id, at desc);

-- Политик нет: таблицу читает и пишет только функция ниже.
alter table club_join_attempts enable row level security;

create or replace function public.join_club_by_code(p_code text, p_display_name text default null)
returns clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  c clubs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if (select count(*) from club_join_attempts
       where user_id = auth.uid() and at > now() - interval '15 minutes') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select * into c from clubs where code = upper(trim(p_code));
  if not found then
    -- No exception here: it would roll back the recorded attempt too.
    -- The app treats an empty result as "club not found".
    insert into club_join_attempts (user_id) values (auth.uid());
    delete from club_join_attempts where at < now() - interval '1 day';
    return null;
  end if;

  insert into club_members (club_id, user_id, display_name)
  values (c.id, auth.uid(), left(p_display_name, 60))
  on conflict (club_id, user_id) do nothing;
  return c;
end;
$$;

revoke all on function public.join_club_by_code(text, text) from public, anon;
grant execute on function public.join_club_by_code(text, text) to authenticated;
