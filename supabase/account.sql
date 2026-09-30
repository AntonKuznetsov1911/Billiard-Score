-- "Твой бильярд" — удаление своего аккаунта.
-- Выполните этот файл в Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- (Он же включён в конец schema.sql.)
--
-- Что удаляется:
--   * сам пользователь (auth.users) и его членство во всех клубах;
--   * клубы, где он был последним участником, — целиком, вместе с данными
--     и историей изменений;
--   * ссылка на него в истории изменений (replaced_by) обнуляется.
-- Что остаётся: общие данные клубов, где есть другие участники, — это данные
-- клуба, а не личные. Создателя у такого клуба больше не будет.

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
