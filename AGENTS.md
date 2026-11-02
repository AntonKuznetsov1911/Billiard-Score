# Твой бильярд

React/Vite приложение, web/PWA и Capacitor Android/iOS. Основной компонент src/BilliardsTracker.jsx, игровая логика src/gameLogic.js. Общий доступ — опциональный Supabase. Telegram Mini App отключен.

## Проверки

- npm ci, npm test, npm run build.
- npm run test:e2e проверяет production-сборку в Chromium; браузер устанавливается npx playwright install chromium.
- npm run android:sync пересобирает web и копирует его в Android.
- Для Android нужны JDK 21 и SDK API 36; android/gradlew assembleDebug lintDebug.

## Данные

Принятые от клуба изменения должны сохраняться локально без обратной сетевой отправки. Итог партии использует устойчивый идентификатор resultIdForGame(game.id). Явное восстановление начинает поколение restoreAt, старое состояние не должно оживлять исключенные записи. Не обрезать журнал событий без сохранения счета: по лимиту пользователь получает понятное сообщение. Колхоз редактируется по кругам, все производные итоги пересчитываются вместе.

## Android

src/native.js — системная отправка файлов/текста, печать и жизненный цикл. NativePrintPlugin — Android-печать. Ключи подписи, .env и локальные SDK/пароли не добавлять в Git. Публикация магазина и изменение живой базы — отдельные действия после подготовки и проверки.

Текущий статус и оставшиеся проверки: docs/ANDROID_RELEASE.md.
