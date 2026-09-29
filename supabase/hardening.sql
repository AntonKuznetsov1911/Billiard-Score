-- Закрытие дыр в правах доступа для УЖЕ работающей базы.
-- Выполните целиком: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Безопасно запускать повторно. (Для новой базы достаточно schema.sql.)

-- 1. Клубы больше нельзя перечислить: раньше любой вошедший мог выгрузить все
--    клубы с кодами приглашения.
drop policy if exists "clubs_select_authenticated" on clubs;
drop policy if exists "clubs_select_members" on clubs;
create policy "clubs_select_members" on clubs
  for select to authenticated using (is_club_member(id) or created_by = auth.uid());

-- 2. В чужой клуб нельзя добавить себя напрямую и нельзя "переехать" сменой club_id.
drop policy if exists "club_members_insert_self" on club_members;
drop policy if exists "club_members_insert_creator" on club_members;
drop policy if exists "club_members_update_self" on club_members;
create policy "club_members_insert_creator" on club_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from clubs c where c.id = club_id and c.created_by = auth.uid())
  );

-- 3. Вступление только по точному коду, через функцию.
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

-- 4. Запись состояния клуба: with check + потолок размера JSON (2 МБ).
drop policy if exists "club_state_update_members" on club_state;
create policy "club_state_update_members" on club_state
  for update to authenticated using (is_club_member(club_id)) with check (is_club_member(club_id));

alter table club_state drop constraint if exists club_state_size_cap;
alter table club_state
  add constraint club_state_size_cap check (octet_length(data::text) < 2000000) not valid;
