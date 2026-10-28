-- "Твой бильярд" — уведомления владельцу в Telegram и статистика пользователей.
-- Выполните в Supabase: Dashboard -> SQL Editor -> New query -> Run
-- (после feedback.sql). Повторный запуск безопасен.
--
-- Токен бота и ваш chat id хранятся в Supabase Vault (зашифрованы), а не в
-- коде. Добавьте их один раз, подставив свои значения:
--   select vault.create_secret('123456:ABC...', 'telegram_bot_token');
--   select vault.create_secret('123456789', 'telegram_chat_id');
-- Поменять позже: select vault.update_secret(id, 'новое значение')
--   (id — из select id, name from vault.secrets).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ===== Отправка сообщения в Telegram =====
create or replace function public.notify_owner(p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_chat text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_chat_id';
  if v_token is null or v_chat is null then
    return; -- бот ещё не настроен
  end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object('chat_id', v_chat, 'text', left(p_text, 4000), 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- Вызывать её может только сама база (триггер, расписание), не приложение.
revoke all on function public.notify_owner(text) from public, anon, authenticated;

-- ===== Новое предложение или ошибка -> сообщение в Telegram =====
create or replace function public.feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_owner(
    case new.kind when 'bug' then '🐞 Ошибка' when 'idea' then '💡 Предложение' else '💬 Сообщение' end
    || E' в «Твоём бильярде»\n\n' || new.message
    || case when new.contact is not null then E'\n\nКонтакт: ' || new.contact else '' end
    || case when new.app_version is not null then E'\nВерсия: ' || new.app_version else '' end
  );
  return new;
end;
$$;

drop trigger if exists feedback_notify_trg on feedback;
create trigger feedback_notify_trg
  after insert on feedback
  for each row execute function public.feedback_notify();

-- ===== Статистика: какие устройства открывали приложение =====
-- Только случайный id устройства (не связан с аккаунтом), день, платформа и
-- версия приложения. Имён, почты и данных о партиях здесь нет.
create table if not exists app_usage (
  device_id uuid not null,
  day date not null default (now() at time zone 'Europe/Moscow')::date,
  platform text not null check (platform in ('android', 'ios', 'pwa', 'web')),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  primary key (device_id, day)
);
create index if not exists app_usage_day on app_usage (day);
alter table app_usage add column if not exists created_at timestamptz not null default now();
create index if not exists app_usage_created on app_usage (created_at);

-- Политик нет: читать таблицу через API нельзя никому, писать — только функцией ниже.
alter table app_usage enable row level security;

-- id устройства присылает само приложение, поэтому с публичным ключом можно
-- прислать и выдуманные: больше 60 новых записей в минуту не принимается —
-- это ограничивает и накрутку, и рост таблицы.
create or replace function public.ping_app(p_device uuid, p_platform text, p_version text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from app_usage where created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into app_usage (device_id, platform, app_version)
  values (p_device,
          case when p_platform in ('android', 'ios', 'pwa', 'web') then p_platform else 'web' end,
          left(p_version, 40))
  on conflict (device_id, day) do nothing;
end;
$$;

revoke all on function public.ping_app(uuid, text, text) from public;
grant execute on function public.ping_app(uuid, text, text) to anon, authenticated;

-- Сводка: выполните `select * from usage_stats();` в SQL Editor в любой момент.
create or replace function public.usage_stats()
returns table (metric text, value bigint)
language sql
security definer
set search_path = public
as $$
  with today as (select (now() at time zone 'Europe/Moscow')::date as d),
  first_seen as (select device_id, min(day) as day from app_usage group by device_id)
  select 'Вчера', count(distinct device_id) from app_usage, today where day = today.d - 1
  union all select 'Сегодня', count(distinct device_id) from app_usage, today where day = today.d
  union all select 'За 7 дней', count(distinct device_id) from app_usage, today where day > today.d - 7
  union all select 'За 30 дней', count(distinct device_id) from app_usage, today where day > today.d - 30
  union all select 'Новых вчера', count(*) from first_seen, today where day = today.d - 1
  union all select 'Всего устройств', count(distinct device_id) from app_usage
  union all select 'Аккаунтов (вход в клуб)', count(*) from auth.users
  union all select 'Клубов', count(*) from clubs
  union all select 'Android (30 дн.)', count(distinct device_id) from app_usage, today where platform = 'android' and day > today.d - 30
  union all select 'iPhone (30 дн.)', count(distinct device_id) from app_usage, today where platform = 'ios' and day > today.d - 30
  union all select 'Браузер/ярлык (30 дн.)', count(distinct device_id) from app_usage, today where platform in ('web', 'pwa') and day > today.d - 30;
$$;

revoke all on function public.usage_stats() from public, anon, authenticated;

-- ===== Ежедневная сводка в Telegram (09:00 по Москве = 06:00 UTC) =====
create or replace function public.send_daily_report()
returns void
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
  v_text := v_text || E'\nОтзывов за сутки: ' || v_feedback;
  perform public.notify_owner(v_text);
end;
$$;

revoke all on function public.send_daily_report() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'billiard-daily-report';
select cron.schedule('billiard-daily-report', '0 6 * * *', 'select public.send_daily_report()');

-- Статистика хранится не дольше 400 дней: каждую ночь удаляется всё старше 395 дней.
select cron.unschedule(jobid) from cron.job where jobname = 'billiard-usage-cleanup';
select cron.schedule('billiard-usage-cleanup', '30 3 * * *', $$delete from app_usage where day < current_date - 395$$);
