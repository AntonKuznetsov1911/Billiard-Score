-- Requires security-2026-11-06.sql (shared JSON validation trigger).
begin;
create table if not exists public.personal_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  write_window timestamptz not null default now(),
  write_count integer not null default 0
);
alter table public.personal_state enable row level security;
revoke all on public.personal_state from public, anon, authenticated;
grant select (user_id, data, revision) on public.personal_state to authenticated;
drop policy if exists personal_state_owner on public.personal_state;
create policy personal_state_owner on public.personal_state for select to authenticated using (user_id=auth.uid());
drop trigger if exists validate_personal_input on public.personal_state;
create trigger validate_personal_input before insert or update of data on public.personal_state
  for each row execute function public.validate_club_input();

create or replace function public.save_personal_state(p_user_id uuid, p_expected_revision integer, p_data jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare caller uuid := auth.uid(); current_row public.personal_state;
begin
  if caller is null or caller is distinct from p_user_id then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid_revision' using errcode='22023'; end if;
  -- Same quotas and shape validation as club data; validation runs in trigger.
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>=2000000 then
    raise exception 'invalid_personal_data' using errcode='22023';
  end if;
  insert into public.personal_state(user_id) values(caller) on conflict(user_id) do nothing;
  select * into current_row from public.personal_state where user_id=caller for update;
  if current_row.revision<>p_expected_revision then return false; end if;
  if current_row.write_window>now()-interval '1 minute' and current_row.write_count>=120 then
    raise exception 'personal_rate_limited' using errcode='P0001';
  end if;
  update public.personal_state set data=p_data, revision=revision+1, updated_at=now(),
    write_window=case when current_row.write_window<=now()-interval '1 minute' then now() else current_row.write_window end,
    write_count=case when current_row.write_window<=now()-interval '1 minute' then 1 else current_row.write_count+1 end
    where user_id=caller;
  return true;
end;
$$;
revoke all on function public.save_personal_state(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_personal_state(uuid,integer,jsonb) to authenticated;
commit;
