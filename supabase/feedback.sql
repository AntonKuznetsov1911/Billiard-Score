-- "Твой бильярд" — предложения и сообщения об ошибках от пользователей.
-- Выполните в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Читать сообщения: Dashboard -> Table Editor -> feedback (только владелец проекта).

create table if not exists feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (contact is null or char_length(contact) <= 100),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);

alter table feedback enable row level security;

-- Писать может кто угодно (в том числе без входа), но только от своего имени.
-- Политик на select/update/delete нет: через API сообщения не прочитать и не
-- изменить никому — только владельцу проекта в панели Supabase.
drop policy if exists "feedback_insert_anyone" on feedback;
create policy "feedback_insert_anyone" on feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

grant insert on feedback to anon, authenticated;
revoke select, update, delete on feedback from anon, authenticated;

-- Защита от спама: не больше 60 сообщений за 10 минут на весь проект
-- и не больше 5 за 10 минут от одного вошедшего пользователя.
create or replace function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from feedback where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;
  if new.user_id is not null and
     (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit_trg on feedback;
create trigger feedback_rate_limit_trg
  before insert on feedback
  for each row execute function public.feedback_rate_limit();
