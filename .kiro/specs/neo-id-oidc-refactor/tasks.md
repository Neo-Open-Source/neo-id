# Tasks

## Task List

- [x] 1. KeyManager: RSA-2048 ключевая пара и JWKS endpoint
  - [x] 1.1 Создать `controllers/key_manager.go` с типом `KeyManager` (загрузка из `RSA_PRIVATE_KEY` env / файла / генерация)
  - [x] 1.2 Добавить метод `Sign(claims jwt.Claims) (string, error)` с `RS256`
  - [x] 1.3 Добавить метод `PublicKeyJWK() map[string]interface{}` (поля `kty`, `use`, `alg`, `kid`, `n`, `e`)
  - [x] 1.4 Инициализировать синглтон `KeyManager` в `main.go` с `log.Fatal` при ошибке
  - [x] 1.5 Переписать `OIDCController.JWKS()` — возвращать RSA публичный ключ из `KeyManager`
  - [x] 1.6 Обновить `OIDCController.Discovery()` — изменить `id_token_signing_alg_values_supported` на `["RS256"]`

- [x] 2. Переход ID Token на RS256
  - [x] 2.1 Переписать `generateIDToken()` — использовать `KeyManager.Sign()` вместо HS256
  - [x] 2.2 Добавить `kid` в заголовок токена из `KeyManager.Kid()`
  - [x] 2.3 Убедиться что `iss`, `sub`, `aud`, `exp`, `iat`, `nonce` присутствуют в каждом токене

- [x] 3. Admin API для управления OIDC-клиентами
  - [x] 3.1 Добавить в `models/site.go` поле `RedirectURIs []string` и `OwnerID string`; написать миграцию/совместимость с существующим `RedirectURI string`
  - [x] 3.2 Создать `controllers/admin_clients.go` с методами `CreateClient`, `ListClients`, `DeleteClient`, `UpdateClient`
  - [x] 3.3 Реализовать `POST /api/admin/clients` — генерация уникальных `client_id`/`client_secret`, валидация `name` и `redirect_uris`
  - [x] 3.4 Реализовать `GET /api/admin/clients` — список всех клиентов
  - [x] 3.5 Реализовать `DELETE /api/admin/clients/:client_id` — удаление клиента + инвалидация всех его `AuthCode`
  - [x] 3.6 Реализовать `PATCH /api/admin/clients/:client_id` — обновление `redirect_uris`, `name`, `logo_url`
  - [x] 3.7 Добавить middleware `requireAdmin` (проверка роли `admin`/`moderator`/`developer`) и применить ко всем `/api/admin/clients` маршрутам; `developer` может создавать/просматривать/редактировать только свои клиенты (фильтр по `owner_id`), `admin`/`moderator` — все
  - [x] 3.8 Зарегистрировать новые маршруты в `routers/routes.go`

- [x] 4. Регистрация и управление сервисами через UI (для developer/admin/moderator)
  - [x] 4.1 Удалить старый маршрут `POST /api/service/register` (публичная регистрация) из `routers/routes.go`
  - [x] 4.2 Удалить маршрут `/register` из `routers/routes.go` (старый frontend route)
  - [x] 4.3 Добавить инвалидацию `AuthCode` при удалении клиента в `SiteCRUD.DeleteSite()` или в контроллере
  - [x] 4.4 Обновить `AdminClientsController.CreateClient` и `ListClients` — разрешить доступ роли `developer`; `developer` видит и управляет только своими клиентами (`owner_id == user.unified_id`), `admin`/`moderator` — всеми
  - [x] 4.5 Обновить `AdminClientsController.DeleteClient` и `UpdateClient` — `developer` может удалять/редактировать только свои клиенты, иначе 403
  - [x] 4.6 Создать `web/src/pages/ServicesPage.jsx` — страница управления сервисами (список своих клиентов с `client_id`, `client_secret`, `redirect_uris`; кнопки создать / редактировать / удалить)
  - [x] 4.7 Добавить маршрут `/services` в `web/src/App.jsx` — доступен только авторизованным пользователям с ролью `developer`, `admin` или `moderator`
  - [x] 4.8 Добавить маршрут `/services` в `routers/routes.go` (frontend SPA route → `MainController.Get`)

- [x] 5. Улучшение управления сессиями
  - [x] 5.1 Добавить в `SessionCRUD` метод `CountUserSessions(userID string) (int, error)`
  - [x] 5.2 Добавить в `SessionCRUD` метод `DeleteOldestSession(userID string) error` (удаляет по минимальному `last_used_at`)
  - [x] 5.3 В `AuthController` при создании новой сессии: если сессий >= 10, вызвать `DeleteOldestSession`
  - [x] 5.4 В `UserController.SetPassword()` добавить инвалидацию всех сессий кроме текущей после успешной смены пароля
  - [x] 5.5 Добавить scheduled job (goroutine с ticker) в `main.go` для `CleanupExpiredSessions()` раз в 24 часа

- [x] 6. Developer-friendly API
  - [x] 6.1 Создать хелпер `respondError(c *web.Controller, status int, code, description string)` в `controllers/helpers.go`
  - [x] 6.2 Заменить все прямые `c.Data["json"] = map[string]interface{}{"error": ...}` на `respondError` во всех контроллерах
  - [x] 6.3 Добавить `GET /api/health` в `AuthController` — возвращает `{"status": "ok", "version": "..."}`
  - [x] 6.4 Добавить заголовок `WWW-Authenticate: Bearer realm="neo-id", error="invalid_token"` при HTTP 401 на защищённых endpoints
  - [x] 6.5 Зарегистрировать `/api/health` в `routers/routes.go`

- [x] 7. Обратная совместимость — проверка и фиксация
  - [x] 7.1 Убедиться что `POST /api/service/verify` возвращает `{"valid": true, "user": {"unified_id", "email", "display_name", "avatar"}}`
  - [x] 7.2 Убедиться что `GET /oauth/userinfo` возвращает `sub`, `email`, `email_verified`, `name`, `picture`
  - [x] 7.3 Убедиться что `POST /api/service/login` возвращает `{"login_url": "..."}`
  - [x] 7.4 Убедиться что popup-режим (`mode=popup`) генерирует корректный HTML с `postMessage`

- [x] 8. Рефакторинг фронтенда — компоненты-секции
  - [x] 8.1 Установить `lucide-react`: `npm install lucide-react` в `web/`
  - [x] 8.2 Создать `web/src/components/sections/ProfileSection.jsx` — перенести логику профиля из `DashboardPage`
  - [x] 8.3 Создать `web/src/components/sections/SecuritySection.jsx` — перенести логику безопасности (пароль, провайдеры, MFA)
  - [x] 8.4 Создать `web/src/components/sections/ServicesSection.jsx` — перенести логику сервисов
  - [x] 8.5 Создать `web/src/components/sections/DeveloperSection.jsx` — перенести логику Service Apps; добавить ссылку/кнопку перехода на страницу управления сервисами `/services` для ролей `developer`/`admin`/`moderator`
  - [x] 8.6 Переместить `SessionsSection.jsx` в `web/src/components/sections/SessionsSection.jsx`
  - [x] 8.7 Рефакторинг `DashboardPage.jsx` — заменить inline-секции на импорты компонентов из `sections/`
  - [x] 8.8 Заменить навигационный пункт "My Sites" на "Services" (ведёт на `/services`) — показывать только для ролей `developer`/`admin`/`moderator`; убрать старую кнопку "Register Site"

- [x] 9. Рефакторинг фронтенда — иконки и маршруты
  - [x] 9.1 Заменить inline SVG иконки навигации в `DashboardPage` на компоненты из `lucide-react` (`User`, `Shield`, `Monitor`, `Code2`)
  - [x] 9.2 Заменить inline SVG иконки Google и GitHub в `LoginPage.jsx` на `lucide-react` или SVG-компоненты без inline кода
  - [x] 9.3 Удалить `RegisterSitePage.jsx` из `web/src/pages/` (заменена на `ServicesPage.jsx`)
  - [x] 9.4 Удалить маршрут `/register` из `web/src/App.jsx` и импорт `RegisterSitePage`

- [x] 10. Тесты
  - [x] 10.1 Написать unit-тесты для `KeyManager`: загрузка ключа, генерация, `PublicKeyJWK()`, `Sign()`
  - [x] 10.2 Написать unit-тест для `verifyCodeChallenge()` — S256 и plain методы
  - [x] 10.3 Написать property-тест P1 (уникальность client_id) с `pgregory.net/rapid`
  - [x] 10.4 Написать property-тест P6+P7 (kid совпадение + RS256 подпись ID_Token)
  - [x] 10.5 Написать property-тест P8 (обязательные claims в ID_Token)
  - [x] 10.6 Написать property-тест P9 (replay protection — повторный auth_code)
  - [x] 10.7 Написать property-тест P10 (PKCE S256 верификация)
  - [x] 10.8 Написать property-тест P11 (лимит 10 сессий)
  - [x] 10.9 Написать property-тест P12 (инвалидация сессий при смене пароля)
  - [x] 10.10 Написать property-тест P14 (формат ошибок)
  - [x] 10.11 Написать smoke-тесты: `/api/health`, CORS заголовки, `POST /api/service/register` → 404

- [x] 11. Рефакторинг бэкенда — разбивка жирных файлов
  - [x] 11.1 Разбить `controllers/auth.go` (1442 строки) на:
    - `controllers/auth_email.go` — email-регистрация, логин, верификация email, MFA (`PasswordRegister`, `PasswordLogin`, `MFAVerify`, `VerifyEmail`, `VerifyEmailCode`, `ResendVerifyEmail`)
    - `controllers/auth_oauth.go` — OAuth провайдеры (`InitOAuthProviders`, `Login`, `Callback`)
    - `controllers/auth_tokens.go` — токены и сессии (`RefreshToken`, `Logout`, `Health`, `generateTokens`, `generateTokensWithDuration`, `generateState`, `generateUnifiedID`, `firstNonEmpty`)
    - `controllers/auth_email_helpers.go` — вспомогательные функции email (`sendResendEmail`, `buildMFACodeHTML`, `buildEmailVerificationHTML`, `generateEmailVerificationCode`)
    - `controllers/auth_oauth_helpers.go` — вспомогательные функции OAuth (`getOAuthCookieSession`, `saveOAuthCookieSession`, `deleteOAuthCookieSession`, `generateSiteTokenForCallback`, `getBaseURL`)
  - [x] 11.2 Разбить `controllers/user.go` (1119 строк) на:
    - `controllers/user_profile.go` — профиль, аватар, пароль (`GetProfile`, `UpdateProfile`, `SetAvatar`, `CompleteProfile`, `SetPassword`, `GetProviders`, `UnlinkProvider`)
    - `controllers/user_apps.go` — service apps (`CreateServiceApp`, `ListServiceApps`, `RevokeServiceApp`, `DeleteServiceApp`)
    - `controllers/user_services.go` — connected services (`GetConnectedServices`, `ConnectService`, `DisconnectService`, `notifyServiceDisconnect`)
    - `controllers/user_sessions.go` — сессии и MFA (`GetSessions`, `RevokeSession`, `SetRefreshDuration`, `ToggleEmailMFA`, `verifyTOTPCode`, `verifyEmailMFACode`)
    - `controllers/user_helpers.go` — общие хелперы (`authenticateUser`, `isDeveloper`, `uploadToImageKit`)
  - [x] 11.3 Разбить `controllers/site_controller.go` (764 строки) на:
    - `controllers/site_management.go` — CRUD сайтов (`RegisterSite`, `GetMySites`, `DeleteSite`, `GetSiteInfo`, `generateSiteID`, `generateAPIKey`, `generateAPISecret`)
    - `controllers/site_oauth.go` — OAuth flow сайтов (`SiteLogin`, `SiteCallback`, `VerifySiteToken`, `UserDeleted`, `generateSiteToken`, `verifySiteToken`)
    - `controllers/site_helpers.go` — вспомогательные функции (`authenticateSite`, `buildAllowedOrigins`, `mergeAllowedOrigins`, `buildRedirectURI`, `getAuthenticatedUser`)
  - [x] 11.4 Убедиться что все файлы компилируются: `go build ./...`
  - [x] 11.5 Убедиться что все маршруты в `routers/routes.go` по-прежнему резолвятся корректно
