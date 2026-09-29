-- История изменений клуба: участник не может стереть данные бесследно.
-- Выполните целиком: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Безопасно запускать повторно. (Для новой базы этот же блок уже входит в schema.sql.)

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
