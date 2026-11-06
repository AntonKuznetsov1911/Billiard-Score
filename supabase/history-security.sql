-- Run after history.sql and security-2026-11-06.sql.
-- Serialize restore with ordinary state updates; bound restore snapshots.
begin;
revoke all on public.club_state_history from anon, authenticated;
grant select on public.club_state_history to authenticated;
revoke all on function public.club_state_snapshot() from public, anon, authenticated;

create or replace function public.restore_club_state(p_history_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  h public.club_state_history;
  cur public.club_state;
  stamp bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode='42501';
  end if;
  select * into h from public.club_state_history where id=p_history_id;
  if not found then raise exception 'snapshot_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.clubs where id=h.club_id and created_by=auth.uid())
     or not public.is_club_member(h.club_id) then
    raise exception 'only_current_creator_can_restore' using errcode='42501';
  end if;
  select * into cur from public.club_state where club_id=h.club_id for update;
  if not found then raise exception 'club_state_not_found' using errcode='P0002'; end if;
  if (select count(*) from public.club_state_history
      where club_id=h.club_id and reason='before_restore'
        and saved_at>now()-interval '1 minute')>=10 then
    raise exception 'restore_rate_limit' using errcode='P0001';
  end if;
  insert into public.club_state_history(club_id,data,replaced_by,matches_count,players_count,reason)
  values(h.club_id,cur.data,auth.uid(),
    coalesce(jsonb_array_length(case when jsonb_typeof(cur.data->'matches')='array' then cur.data->'matches' end),0),
    coalesce(jsonb_array_length(case when jsonb_typeof(cur.data->'players')='array' then cur.data->'players' end),0),
    'before_restore');
  stamp := (extract(epoch from clock_timestamp())*1000)::bigint;
  update public.club_state set data=jsonb_set(jsonb_set(h.data,'{updatedAt}',to_jsonb(stamp)),'{restoreAt}',to_jsonb(stamp)),
    updated_at=now() where club_id=h.club_id;
  delete from public.club_state_history where club_id=h.club_id and
    (saved_at<now()-interval '180 days' or id in
      (select id from public.club_state_history where club_id=h.club_id order by saved_at desc,id desc offset 2000));
end;
$$;
revoke all on function public.restore_club_state(bigint) from public, anon;
grant execute on function public.restore_club_state(bigint) to authenticated;
commit;
