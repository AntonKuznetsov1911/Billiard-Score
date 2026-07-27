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

-- clubs: любой вошедший пользователь может найти клуб по коду (это и есть приглашение),
-- но создать клуб можно только от своего имени.
create policy "clubs_select_authenticated" on clubs
  for select to authenticated using (true);

create policy "clubs_insert_own" on clubs
  for insert to authenticated with check (created_by = auth.uid());

-- club_members: видно только строки твоих собственных клубов; вступить можно только самому себе.
create policy "club_members_select_own_clubs" on club_members
  for select to authenticated using (is_club_member(club_id));

create policy "club_members_insert_self" on club_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "club_members_delete_self" on club_members
  for delete to authenticated using (user_id = auth.uid());

-- club_state: читать и писать может только участник этого клуба.
create policy "club_state_select_members" on club_state
  for select to authenticated using (is_club_member(club_id));

create policy "club_state_insert_members" on club_state
  for insert to authenticated with check (is_club_member(club_id));

create policy "club_state_update_members" on club_state
  for update to authenticated using (is_club_member(club_id));

-- Realtime: включить публикацию изменений club_state, чтобы все участники видели обновления сразу.
alter publication supabase_realtime add table club_state;
