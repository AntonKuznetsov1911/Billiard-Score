# Публикация в Google Play, App Store и RuStore

Приложение одно: тот же React-код упакован в нативную оболочку
[Capacitor](https://capacitorjs.com). Папки `android/` и `ios/` — нативные
проекты, `capacitor.config.json` — их настройки. ID приложения:
`io.github.antonkuznetsov1911.billiard` (после первой публикации его
поменять нельзя).

После любых изменений в коде:

```bash
npm run build
npx cap sync          # копирует dist/ в android/ и ios/
```

## Android (Google Play и RuStore)

### Тестовая сборка без Android Studio
GitHub → Actions → **Android build** → Run workflow. Через несколько минут
в артефактах будет `billiard-debug-apk`: скачайте, перекиньте на телефон
и установите (разрешите установку из неизвестных источников).

### Ключ подписи (один раз, хранить вечно)
Без этого ключа нельзя выпустить обновление, держите копию в надёжном месте.

```bash
keytool -genkeypair -v -keystore billiard-release.keystore -alias billiard \
  -keyalg RSA -keysize 2048 -validity 10000
# PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("billiard-release.keystore")) | Set-Clipboard
base64 -w0 billiard-release.keystore
```

Добавьте секреты репозитория (Settings → Secrets and variables → Actions):
`ANDROID_KEYSTORE_BASE64` (строка base64), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (`billiard`), `ANDROID_KEY_PASSWORD`. Тогда workflow
дополнительно соберёт `billiard-release-aab` — файл для загрузки в магазин.

### Публикация
- **Google Play**: аккаунт разработчика (разовый взнос $25), Play Console →
  создать приложение → загрузить `.aab`. Новые личные аккаунты обязаны
  провести закрытое тестирование (12+ тестировщиков, 14 дней) перед
  выходом в открытый доступ.
- **RuStore** (удобнее для пользователей в РФ, регистрация бесплатная):
  console.rustore.ru → добавить приложение → загрузить тот же `.aab` или `.apk`.
- Перед каждым обновлением увеличьте `versionCode` и `versionName` в
  `android/app/build.gradle`.

## iOS (App Store)

Нужны Mac с Xcode и аккаунт Apple Developer ($99 в год).

```bash
npm ci && npm run build && npx cap sync ios
npx cap open ios      # откроется Xcode
```

В Xcode: Signing & Capabilities → выберите свою команду, затем
Product → Archive → Distribute App → App Store Connect.

## Для обоих магазинов
- **Политика конфиденциальности**: `https://antonkuznetsov1911.github.io/Billiard-Score/privacy.html`
  (файл `public/privacy.html`, публикуется вместе с сайтом).
- **Удаление аккаунта** внутри приложения уже есть (Ещё → Удаление данных) —
  это обязательное требование обоих магазинов.
- **Вход в клуб в приложении** — по 6-значному коду из письма. Вход через
  Google и по ссылке из письма в нативном приложении скрыт: они
  возвращаются в браузер, а не в приложение.
