-- "Твой бильярд" — общий доступ (клубы)
-- Выполните этот файл целиком в Supabase: Dashboard -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

-- Клубы: у каждого клуба есть короткий код приглашения.
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default 'Мой клуб',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Участники клуба (кто в каком клубе состоит).
create table if not exists club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- Общее состояние приложения клуба: один JSON-блок на клуб
-- (игроки, партии, серии, турнирная сетка — та же структура, что и в localStorage).
create table if not exists club_state (
  club_id uuid primary key references clubs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table clubs enable row level security;
alter table club_members enable row level security;
alter table club_state enable row level security;

-- Проверка "состоит ли текущий пользователь в клубе X" вынесена в отдельную
-- security definer функцию: она выполняется с обходом RLS, поэтому политика
-- club_members, которая иначе обращалась бы сама к себе через подзапрос,
-- не уходит в бесконечную рекурсию (ошибка "infinite recursion detected
-- in policy for relation club_members").
create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from club_members
    where club_id = target_club_id and user_id = auth.uid()
  );
$$;

-- clubs: видеть клуб может только его участник или создатель. Раньше здесь было
-- "using (true)" — любой вошедший мог выгрузить ВСЕ клубы вместе с кодами
-- приглашения и вступить куда угодно. Вступление по коду идёт только через
-- функцию join_club_by_code (ниже), которая отдаёт клуб лишь по точному коду.
create policy "clubs_select_members" on clubs
  for select to authenticated using (is_club_member(id) or created_by = auth.uid());

create policy "clubs_insert_own" on clubs
  for insert to authenticated with check (created_by = auth.uid());

-- club_members: видно только строки твоих собственных клубов. Напрямую добавить
-- себя можно только в клуб, который ты сам создал; в чужой — только через
-- join_club_by_code. UPDATE-политики нет намеренно: иначе можно было бы сменить
-- club_id у своей строки и "переехать" в чужой клуб без кода.
create policy "club_members_select_own_clubs" on club_members
  for select to authenticated using (is_club_member(club_id));

create policy "club_members_insert_creator" on club_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from clubs c where c.id = club_id and c.created_by = auth.uid())
  );

create policy "club_members_delete_self" on club_members
  for delete to authenticated using (user_id = auth.uid());

-- Вступление по коду: единственный способ попасть в чужой клуб.
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
  select * into c from clubs where code = upper(trim(p_code));
  if not found then
    raise exception 'club_not_found' using errcode = 'P0002';
  end if;
  insert into club_members (club_id, user_id, display_name)
  values (c.id, auth.uid(), left(p_display_name, 60))
  on conflict (club_id, user_id) do nothing;
  return c;
end;
$$;

revoke all on function public.join_club_by_code(text, text) from public, anon;
grant execute on function public.join_club_by_code(text, text) to authenticated;

-- club_state: читать и писать может только участник этого клуба; размер ограничен,
-- чтобы участник не мог забить хранилище огромным JSON.
create policy "club_state_select_members" on club_state
  for select to authenticated using (is_club_member(club_id));

create policy "club_state_insert_members" on club_state
  for insert to authenticated with check (is_club_member(club_id));

create policy "club_state_update_members" on club_state
  for update to authenticated using (is_club_member(club_id)) with check (is_club_member(club_id));

alter table club_state
  add constraint club_state_size_cap check (octet_length(data::text) < 2000000) not valid;

-- Realtime: включить публикацию изменений club_state, чтобы все участники видели обновления сразу.
alter publication supabase_realtime add table club_state;
