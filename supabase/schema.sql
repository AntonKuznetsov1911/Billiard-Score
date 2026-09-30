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

-- ===== История изменений (см. также supabase/history.sql) =====

create table if not exists club_state_history (
  id bigint generated always as identity primary key,
  club_id uuid not null references clubs(id) on delete cascade,
  data jsonb not null,               -- состояние клуба ДО изменения
  saved_at timestamptz not null default now(),
  replaced_by uuid,                  -- кто внёс изменение, заменившее это состояние
  matches_count int not null default 0,
  players_count int not null default 0,
  reason text not null default 'periodic'   -- periodic | shrink | before_restore
);

create index if not exists club_state_history_club_time on club_state_history (club_id, saved_at desc);

alter table club_state_history enable row level security;

-- Читать историю могут участники клуба. Политик на insert/update/delete НЕТ
-- намеренно: записи создаёт только триггер ниже, изменить или удалить их
-- через API нельзя никому (удаляются только вместе с самим клубом или по сроку).
drop policy if exists "club_state_history_select_members" on club_state_history;
create policy "club_state_history_select_members" on club_state_history
  for select to authenticated using (is_club_member(club_id));

-- Перед каждой заменой состояния клуба сохраняем прежнее:
--   * сразу, если данных стало меньше (удалили партии/игроков) — не чаще раза в минуту;
--   * иначе не чаще раза в 10 минут (хронология без раздувания хранилища).
create or replace function public.club_state_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
  old_m int := coalesce(jsonb_array_length(case when jsonb_typeof(old.data->'matches') = 'array' then old.data->'matches' end), 0);
  new_m int := coalesce(jsonb_array_length(case when jsonb_typeof(new.data->'matches') = 'array' then new.data->'matches' end), 0);
  old_p int := coalesce(jsonb_array_length(case when jsonb_typeof(old.data->'players') = 'array' then old.data->'players' end), 0);
  new_p int := coalesce(jsonb_array_length(case when jsonb_typeof(new.data->'players') = 'array' then new.data->'players' end), 0);
  shrink boolean;
begin
  select max(saved_at) into last_at from club_state_history where club_id = old.club_id;
  shrink := new_m < old_m or new_p < old_p;

  if last_at is null
     or (shrink and now() - last_at > interval '1 minute')
     or now() - last_at > interval '10 minutes' then
    insert into club_state_history (club_id, data, replaced_by, matches_count, players_count, reason)
    values (old.club_id, old.data, auth.uid(), old_m, old_p, case when shrink then 'shrink' else 'periodic' end);

    -- Срок хранения 180 дней и потолок 2000 снимков на клуб.
    delete from club_state_history
    where club_id = old.club_id
      and (saved_at < now() - interval '180 days'
           or id in (select id from club_state_history where club_id = old.club_id order by saved_at desc offset 2000));
  end if;
  return new;
end;
$$;

drop trigger if exists club_state_snapshot_trg on club_state;
create trigger club_state_snapshot_trg
  before update on club_state
  for each row execute function public.club_state_snapshot();

-- Восстановление снимка — только создатель клуба. Текущее состояние перед этим
-- тоже сохраняется, так что восстановление само можно откатить.
create or replace function public.restore_club_state(p_history_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h club_state_history;
  cur club_state;
  restored jsonb;
begin
  select * into h from club_state_history where id = p_history_id;
  if not found then
    raise exception 'snapshot_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from clubs where id = h.club_id and created_by = auth.uid()) then
    raise exception 'only_creator_can_restore' using errcode = '42501';
  end if;

  select * into cur from club_state where club_id = h.club_id;
  insert into club_state_history (club_id, data, replaced_by, matches_count, players_count, reason)
  values (
    h.club_id, cur.data, auth.uid(),
    coalesce(jsonb_array_length(case when jsonb_typeof(cur.data->'matches') = 'array' then cur.data->'matches' end), 0),
    coalesce(jsonb_array_length(case when jsonb_typeof(cur.data->'players') = 'array' then cur.data->'players' end), 0),
    'before_restore'
  );

  -- Метка времени внутри данных должна быть новой, иначе клиенты сочтут
  -- восстановленное состояние устаревшим и проигнорируют его.
  restored := jsonb_set(h.data, '{updatedAt}', to_jsonb((extract(epoch from now()) * 1000)::bigint));
  update club_state set data = restored, updated_at = now() where club_id = h.club_id;
end;
$$;

revoke all on function public.restore_club_state(bigint) from public, anon;
grant execute on function public.restore_club_state(bigint) to authenticated;

-- Своё имя в клубе (для журнала изменений). Меняет только display_name своей
-- строки: UPDATE-политики на club_members нет, поэтому через функцию.
create or replace function public.set_my_club_name(p_club_id uuid, p_name text)
returns void
language sql
security definer
set search_path = public
as $$
  update club_members
     set display_name = nullif(left(trim(p_name), 40), '')
   where club_id = p_club_id and user_id = auth.uid();
$$;

revoke all on function public.set_my_club_name(uuid, text) from public, anon;
grant execute on function public.set_my_club_name(uuid, text) to authenticated;

-- Удаление своего аккаунта (см. также supabase/account.sql).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  delete from clubs c
   where exists (select 1 from club_members m where m.club_id = c.id and m.user_id = uid)
     and not exists (select 1 from club_members m where m.club_id = c.id and m.user_id <> uid);

  delete from club_members where user_id = uid;
  update clubs set created_by = null where created_by = uid;
  update club_state_history set replaced_by = null where replaced_by = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Realtime: включить публикацию изменений club_state, чтобы все участники видели обновления сразу.
alter publication supabase_realtime add table club_state;
