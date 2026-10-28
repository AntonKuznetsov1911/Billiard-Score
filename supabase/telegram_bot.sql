-- "Твой бильярд" — команда /stats и кнопка «📊 Статистика» в Telegram-боте.
-- Выполните в Supabase: Dashboard -> SQL Editor -> New query -> Run
-- (после telegram.sql). Повторный запуск безопасен.
--
-- Отдельный сервер не нужен: каждые 15 секунд база сама спрашивает у
-- Telegram новые сообщения боту (getUpdates) и отвечает сводкой — только
-- владельцу (chat id из Vault), остальным бот ничего не показывает.

-- ===== Текст сводки (общий для /stats и утреннего отчёта) =====
create or replace function public.stats_text()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := E'📊 «Твой бильярд» — сводка\n';
  r record;
  v_feedback bigint;
begin
  for r in select * from public.usage_stats() loop
    v_text := v_text || E'\n' || r.metric || ': ' || r.value;
  end loop;
  select count(*) into v_feedback from feedback where created_at > now() - interval '1 day';
  return v_text || E'\nОтзывов за сутки: ' || v_feedback;
end;
$$;

revoke all on function public.stats_text() from public, anon, authenticated;

create or replace function public.send_daily_report()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_owner(public.stats_text());
end;
$$;

-- ===== Состояние опроса бота =====
create table if not exists tg_bot_state (
  id int primary key default 1 check (id = 1),
  next_offset bigint not null default 0,
  pending_request bigint,
  pending_at timestamptz
);
insert into tg_bot_state (id) values (1) on conflict (id) do nothing;
-- Политик нет: таблицу видит только сама база.
alter table tg_bot_state enable row level security;

-- ===== Ответ владельцу с кнопкой «📊 Статистика» внизу чата =====
create or replace function public.tg_reply(p_token text, p_chat text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || p_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', p_chat,
      'text', left(p_text, 4000),
      'reply_markup', jsonb_build_object(
        'keyboard', jsonb_build_array(jsonb_build_array(jsonb_build_object('text', '📊 Статистика'))),
        'resize_keyboard', true,
        'is_persistent', true
      )
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function public.tg_reply(text, text, text) from public, anon, authenticated;

-- ===== Опрос: забрать ответ прошлого запроса, ответить, запросить новые =====
create or replace function public.tg_poll()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat text;
  st tg_bot_state;
  resp record;
  upd jsonb;
  v_max bigint;
  v_msg text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_chat_id';
  if v_token is null or v_chat is null then
    return;
  end if;

  select * into st from tg_bot_state where id = 1 for update;

  if st.pending_request is not null then
    select status_code, content into resp from net._http_response where id = st.pending_request;
    if not found then
      -- ответ ещё не пришёл; если запрос потерялся — через минуту спросим заново
      if st.pending_at > now() - interval '1 minute' then
        return;
      end if;
    elsif resp.status_code = 200 then
      for upd in select * from jsonb_array_elements(coalesce(resp.content::jsonb -> 'result', '[]'::jsonb)) loop
        v_max := greatest(coalesce(v_max, 0), (upd ->> 'update_id')::bigint);
        v_msg := lower(coalesce(upd #>> '{message,text}', ''));
        if upd #>> '{message,chat,id}' = v_chat
           and (v_msg like '/stats%' or v_msg like '/start%' or v_msg like '%статистик%') then
          perform public.tg_reply(v_token, v_chat, public.stats_text());
        end if;
      end loop;
      if v_max is not null then
        st.next_offset := v_max + 1;
      end if;
    end if;
  end if;

  update tg_bot_state
     set next_offset = st.next_offset,
         pending_request = net.http_get(
           url := 'https://api.telegram.org/bot' || v_token || '/getUpdates?timeout=0'
                  || '&allowed_updates=%5B%22message%22%5D&offset=' || st.next_offset
         ),
         pending_at = now()
   where id = 1;
end;
$$;

revoke all on function public.tg_poll() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'billiard-bot-poll';
select cron.schedule('billiard-bot-poll', '15 seconds', 'select public.tg_poll()');

-- ===== Команда /stats в меню бота =====
do $$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_token is not null then
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/setMyCommands',
      body := '{"commands": [{"command": "stats", "description": "Статистика приложения"}]}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
end;
$$;
