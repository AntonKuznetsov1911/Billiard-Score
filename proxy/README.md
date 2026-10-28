# Клуб без VPN: прокси для Supabase

Само приложение (GitHub Pages) открывается без VPN: шрифты и скрипт Telegram
лежат внутри него, а партии хранятся на устройстве. Но общий доступ (клубы)
ходит на `*.supabase.co`, а этот домен у части российских провайдеров
блокируется или замедляется. Тогда синхронизация с клубом работает только
с VPN. Само приложение при этом не зависает: запросы обрываются через
12 секунд, и синхронизация повторяется позже.

Чтобы клуб работал у всех без VPN, нужен свой домен, который пересылает
запросы в Supabase. Это обычный обратный прокси (reverse proxy), данные
идут насквозь и на нём не хранятся.

## Вариант: VPS в России + nginx

1. Арендуйте самый дешёвый VPS у российского хостера (Timeweb, Selectel,
   REG.RU, Yandex Cloud) и привяжите к нему домен или поддомен, например
   `api.мой-бильярд.рф` (A-запись на IP сервера).
2. Установите nginx и certbot, получите сертификат:
   `sudo apt install nginx certbot python3-certbot-nginx`
   `sudo certbot --nginx -d api.example.ru`
3. Скопируйте `nginx.conf` из этой папки в `/etc/nginx/sites-available/billiard`,
   замените `api.example.ru` и `YOUR_PROJECT` (id проекта Supabase, например
   `zvbkgukuivojaxzyqaii`), включите сайт и перезапустите nginx:
   `sudo ln -s /etc/nginx/sites-available/billiard /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`
4. Проверьте: `curl https://api.example.ru/auth/v1/health` должен вернуть
   ответ Supabase (401 без ключа — это нормально).
5. В GitHub → Settings → Secrets and variables → Actions поменяйте
   `VITE_SUPABASE_URL` на `https://api.example.ru`. Следующий деплой
   начнёт ходить через прокси.
6. В Supabase → Authentication → URL Configuration ничего менять не нужно:
   ссылки входа по-прежнему ведут обратно в приложение.

Ключ `anon` публичный, а доступ к данным защищают правила RLS в базе
(`supabase/schema.sql`), поэтому прокси ничего не раскрывает. Ключ
`service_role` на прокси не нужен и класть его туда нельзя.
