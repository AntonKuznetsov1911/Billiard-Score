-- Security hardening 2026-11-06. Run after schema.sql and feedback.sql.
-- All changes are transactional. Existing oversized rows are not rewritten.
begin;
revoke create on schema public from public, anon, authenticated;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_state enable row level security;
do $$ begin
  if to_regclass('public.club_state_history') is not null then
    execute 'alter table public.club_state_history enable row level security';
  end if;
end $$;
alter table public.feedback enable row level security;
alter table public.club_join_attempts enable row level security;

drop policy if exists clubs_select_authenticated on public.clubs;
drop policy if exists clubs_select_members on public.clubs;
create policy clubs_select_members on public.clubs for select to authenticated
  using (public.is_club_member(id) or created_by=auth.uid());
drop policy if exists club_members_insert_self on public.club_members;
drop policy if exists club_members_update_self on public.club_members;
drop policy if exists club_members_insert_creator on public.club_members;
create policy club_members_insert_creator on public.club_members for insert to authenticated
  with check (user_id=auth.uid() and exists(
    select 1 from public.clubs c where c.id=club_id and c.created_by=auth.uid()));
drop policy if exists club_state_update_members on public.club_state;
create policy club_state_update_members on public.club_state for update to authenticated
  using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));

revoke all on public.club_join_attempts from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

create or replace function public.join_club_by_code(p_code text, p_display_name text default null)
returns public.clubs language plpgsql security definer set search_path = public as $$
declare c public.clubs; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended('club-join:' || caller::text, 0));
  if (select count(*) from public.club_join_attempts where user_id=caller and at>now()-interval '15 minutes')>=10 then
    raise exception 'too_many_attempts' using errcode='P0001';
  end if;
  insert into public.club_join_attempts(user_id) values(caller);
  delete from public.club_join_attempts where user_id=caller and at<now()-interval '1 day';
  if p_code is null or length(p_code)>32 or length(coalesce(p_display_name,''))>60 then return null; end if;
  select * into c from public.clubs where code=upper(trim(p_code));
  if not found then return null; end if;
  insert into public.club_members(club_id,user_id,display_name)
    values(c.id,caller,nullif(trim(p_display_name),''))
    on conflict(club_id,user_id) do nothing;
  return c;
end;
$$;
revoke all on function public.join_club_by_code(text,text) from public, anon;
grant execute on function public.join_club_by_code(text,text) to authenticated;

create or replace function public.feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid();
begin
  -- Identity is assigned by the server, never by the submitted JSON.
  new.user_id := caller;
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtextextended('feedback-global',0));
  if (select count(*) from public.feedback where created_at>now()-interval '10 minutes')>=60 then
    raise exception 'feedback_rate_limited' using errcode='P0001';
  end if;
  if caller is not null and (select count(*) from public.feedback where user_id=caller and created_at>now()-interval '10 minutes')>=5 then
    raise exception 'feedback_rate_limited' using errcode='P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit_trg on public.feedback;
create trigger feedback_rate_limit_trg before insert on public.feedback
  for each row execute function public.feedback_rate_limit();

create or replace function public.validate_club_input()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid(); field text; item jsonb;
begin
  if tg_table_name='clubs' then
    if new.code !~ '^[A-Z0-9]{6,32}$' or length(trim(new.name)) not between 1 and 80 then
      raise exception 'invalid_club' using errcode='22023';
    end if;
    if tg_op='INSERT' and caller is not null then
      perform pg_advisory_xact_lock(hashtextextended('club-create:'||caller::text,0));
      if (select count(*) from public.clubs where created_by=caller and created_at>now()-interval '1 day')>=20 then
        raise exception 'club_creation_rate_limited' using errcode='P0001';
      end if;
      new.created_at := now();
    end if;
  elsif tg_table_name='club_members' then
    if length(coalesce(new.display_name,''))>60 then raise exception 'invalid_display_name' using errcode='22023'; end if;
  else
    if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>=2000000 then
      raise exception 'invalid_club_data' using errcode='22023';
    end if;
    foreach field in array array['players','matches','trash','activeGames'] loop
      if new.data ? field then
        if jsonb_typeof(new.data->field) is distinct from 'array' then raise exception 'invalid_club_data' using errcode='22023'; end if;
        if jsonb_array_length(new.data->field)> (case field when 'players' then 200 when 'activeGames' then 20 else 20000 end) then
          raise exception 'invalid_club_data' using errcode='22023';
        end if;
      end if;
    end loop;
    for item in select value from jsonb_array_elements(coalesce(new.data->'players','[]'::jsonb)) loop
      if jsonb_typeof(item) is distinct from 'object'
        or jsonb_typeof(item->'id') is distinct from 'string'
        or length(item->>'id') not between 1 and 64
        or item->>'id' in ('__proto__','constructor','prototype')
        or jsonb_typeof(item->'name') is distinct from 'string'
        or length(item->>'name')>40 then
        raise exception 'invalid_player' using errcode='22023';
      end if;
    end loop;
    foreach field in array array['matches','trash','activeGames'] loop
      for item in select value from jsonb_array_elements(coalesce(new.data->field,'[]'::jsonb)) loop
        if jsonb_typeof(item) is distinct from 'object' then
          raise exception 'invalid_game_record' using errcode='22023';
        end if;
        if item ? 'participants' then
          if jsonb_typeof(item->'participants') is distinct from 'array' then
            raise exception 'invalid_participants' using errcode='22023';
          end if;
          if jsonb_array_length(item->'participants')>20 or exists(
            select 1 from jsonb_array_elements(item->'participants') participant
            where jsonb_typeof(participant) is distinct from 'string'
              or length(participant #>> '{}') not between 1 and 64
              or participant #>> '{}' in ('__proto__','constructor','prototype')
          ) then raise exception 'invalid_participants' using errcode='22023'; end if;
        end if;
        if item ? 'scores' then
          if jsonb_typeof(item->'scores') is distinct from 'object' then
            raise exception 'invalid_scores' using errcode='22023';
          end if;
          if (select count(*) from jsonb_object_keys(item->'scores'))>20 or exists(
            select 1 from jsonb_each(item->'scores') score where
              score.key in ('__proto__','constructor','prototype') or
              case when jsonb_typeof(score.value)='number'
                then (score.value::text)::numeric not between 0 and 999 else true end
          ) then raise exception 'invalid_scores' using errcode='22023'; end if;
        end if;
      end loop;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_clubs_input on public.clubs;
create trigger validate_clubs_input before insert or update on public.clubs for each row execute function public.validate_club_input();
drop trigger if exists validate_members_input on public.club_members;
create trigger validate_members_input before insert or update on public.club_members for each row execute function public.validate_club_input();
drop trigger if exists validate_state_input on public.club_state;
create trigger validate_state_input before insert or update on public.club_state for each row execute function public.validate_club_input();

-- Trigger-only functions must not be callable through PostgREST.
revoke all on function public.feedback_rate_limit() from public, anon, authenticated;
revoke all on function public.validate_club_input() from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.club_state_snapshot()') is not null then
    execute 'revoke all on function public.club_state_snapshot() from public, anon, authenticated';
  end if;
end $$;
revoke all on function public.is_club_member(uuid) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;
-- The public analytics RPC also has a serialized project-wide write budget.
do $outer$ begin
  if to_regclass('public.app_usage') is not null then
    execute 'alter table public.app_usage enable row level security';
    execute 'revoke all on public.app_usage from anon, authenticated';
    execute $function$
      create or replace function public.ping_app(p_device uuid, p_platform text, p_version text default null)
      returns void language plpgsql security definer set search_path = public as $body$
      begin
        if p_device is null or p_platform not in ('android','ios','pwa','web')
          or p_platform is null or length(coalesce(p_version,''))>40 then
          raise exception 'invalid_usage' using errcode='22023';
        end if;
        perform pg_advisory_xact_lock(hashtextextended('usage-global',0));
        if (select count(*) from public.app_usage where created_at>now()-interval '1 minute')>=60 then return; end if;
        insert into public.app_usage(device_id,platform,app_version) values(p_device,p_platform,p_version)
          on conflict(device_id,day) do nothing;
      end;
      $body$;
    $function$;
  end if;
end $outer$;
do $$ begin
  if to_regprocedure('public.feedback_notify()') is not null then
    execute 'revoke all on function public.feedback_notify() from public, anon, authenticated';
  end if;
end $$;
commit;
