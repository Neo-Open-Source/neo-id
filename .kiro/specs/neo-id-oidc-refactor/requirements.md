# Requirements Document

## Introduction

Масштабный рефакторинг Neo ID — SSO/OIDC провайдера на Go (Beego) + React. Цель: убрать устаревшую логику "Register Site" через UI, привести OIDC-реализацию к стандарту, улучшить сессии, сделать developer-friendly API и переработать фронтенд по компонентам с нормальными иконками.

Проект используется как единый провайдер аутентификации для сервисов (neomovies-api, neomovies-web и других). Обратная совместимость с уже интегрированными сервисами обязательна.

---

## Glossary

- **Neo_ID** — сервис аутентификации (данная система)
- **OIDC_Provider** — компонент Neo ID, реализующий OpenID Connect 1.0
- **Client** — внешний сервис, интегрированный с Neo ID через OIDC (например, neomovies-api)
- **User** — конечный пользователь, аутентифицирующийся через Neo ID
- **Admin** — пользователь с ролью `admin` или `moderator`
- **Developer** — пользователь с ролью `developer`, `admin` или `moderator`
- **Session** — запись в БД, связывающая access_token с пользователем
- **Access_Token** — короткоживущий JWT (24 ч), используемый для API-запросов
- **Refresh_Token** — долгоживущий токен для обновления Access_Token
- **ID_Token** — JWT с claims о пользователе, выдаваемый в OIDC-потоке
- **Auth_Code** — одноразовый код авторизации (10 мин), используемый в Authorization Code Flow
- **Site** — зарегистрированный OIDC-клиент (запись в БД с `client_id`, `client_secret`, `redirect_uris`)
- **PKCE** — Proof Key for Code Exchange (RFC 7636)
- **Dashboard** — веб-интерфейс пользователя Neo ID
- **Service_App** — API-токен для machine-to-machine доступа (developer feature)

---

## Requirements

### Requirement 1: Управление OIDC-клиентами через Admin API

**User Story:** As an Admin, I want to register and manage OIDC clients (sites) via API and UI form, so that client registration is controlled and auditable.

#### Acceptance Criteria

1. THE Neo_ID SHALL предоставлять endpoint `POST /api/admin/clients` для создания нового OIDC-клиента, доступный только пользователям с ролью `admin` или `moderator`.
2. WHEN Admin создаёт клиента, THE Neo_ID SHALL генерировать уникальные `client_id`, `client_secret` и возвращать их в ответе.
3. THE Neo_ID SHALL предоставлять endpoint `GET /api/admin/clients` для получения списка всех клиентов, доступный только Admin.
4. THE Neo_ID SHALL предоставлять endpoint `DELETE /api/admin/clients/:client_id` для удаления клиента, доступный только Admin.
5. THE Neo_ID SHALL предоставлять endpoint `PATCH /api/admin/clients/:client_id` для обновления `redirect_uris`, `name`, `logo_url` клиента, доступный только Admin.
6. IF запрос на создание клиента не содержит обязательных полей (`name`, `redirect_uris`), THEN THE Neo_ID SHALL вернуть HTTP 400 с описанием ошибки.
7. THE Neo_ID SHALL удалить маршрут `POST /api/site/register` и страницу `/register` из фронтенда.
8. WHEN клиент удаляется, THE Neo_ID SHALL деактивировать все активные Auth_Code, связанные с этим клиентом.

---

### Requirement 2: Стандартные OIDC Endpoints

**User Story:** As a Developer integrating a service, I want standard OIDC endpoints that comply with OpenID Connect Core 1.0, so that I can use any standard OIDC library without custom code.

#### Acceptance Criteria

1. THE OIDC_Provider SHALL предоставлять discovery document на `GET /.well-known/openid-configuration` со всеми обязательными полями согласно OpenID Connect Discovery 1.0.
2. THE OIDC_Provider SHALL предоставлять `GET /.well-known/jwks.json` с публичными ключами для верификации ID_Token.
3. WHEN OIDC_Provider использует асимметричный алгоритм подписи (RS256), THE OIDC_Provider SHALL включать публичный ключ в JWKS endpoint.
4. THE OIDC_Provider SHALL поддерживать Authorization Code Flow на `GET /oauth/authorize` с параметрами `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `nonce`.
5. THE OIDC_Provider SHALL поддерживать `POST /oauth/token` для обмена Auth_Code на Access_Token, Refresh_Token и ID_Token.
6. THE OIDC_Provider SHALL поддерживать `GET /oauth/userinfo` с Bearer Access_Token и возвращать стандартные OIDC claims (`sub`, `email`, `email_verified`, `name`, `picture`).
7. THE OIDC_Provider SHALL поддерживать `POST /oauth/revoke` согласно RFC 7009.
8. WHEN Client передаёт невалидный `redirect_uri`, THE OIDC_Provider SHALL вернуть ошибку `invalid_request` без редиректа.
9. THE OIDC_Provider SHALL поддерживать PKCE (S256 и plain) согласно RFC 7636.
10. WHEN ID_Token генерируется, THE OIDC_Provider SHALL подписывать его алгоритмом RS256 с ключом из JWKS.
11. THE OIDC_Provider SHALL включать `iss`, `sub`, `aud`, `exp`, `iat`, `nonce` (если передан) в каждый ID_Token.
12. WHEN Auth_Code уже был использован, THE OIDC_Provider SHALL вернуть ошибку `invalid_grant` и аннулировать все токены, выданные по этому коду (защита от replay-атак).

---

### Requirement 3: Управление сессиями

**User Story:** As a User, I want my sessions to work reliably across devices and be manageable from the dashboard, so that I have control over my active logins.

#### Acceptance Criteria

1. WHEN User успешно аутентифицируется, THE Neo_ID SHALL создавать Session с уникальным `session_id`, `access_token`, `refresh_token`, `ip_address`, `user_agent`, `created_at`, `last_used_at`, `expires_at`.
2. WHEN User делает запрос с валидным Access_Token, THE Neo_ID SHALL обновлять `last_used_at` для соответствующей Session.
3. WHEN Access_Token истекает, THE Neo_ID SHALL принимать Refresh_Token на `POST /api/auth/refresh` и выдавать новый Access_Token без повторной аутентификации.
4. IF Refresh_Token истёк или отозван, THEN THE Neo_ID SHALL вернуть HTTP 401 и потребовать повторной аутентификации.
5. THE Neo_ID SHALL предоставлять `GET /api/user/sessions` для получения списка активных сессий пользователя с полями `session_id`, `ip_address`, `user_agent`, `created_at`, `last_used_at`.
6. WHEN User отзывает сессию через `POST /api/user/sessions/revoke`, THE Neo_ID SHALL немедленно инвалидировать соответствующий Access_Token и Refresh_Token.
7. THE Neo_ID SHALL автоматически удалять истёкшие сессии из БД по расписанию (не реже 1 раза в сутки).
8. WHEN User меняет пароль, THE Neo_ID SHALL инвалидировать все сессии кроме текущей.
9. THE Neo_ID SHALL хранить не более 10 активных сессий на пользователя; WHEN создаётся 11-я сессия, THE Neo_ID SHALL удалять самую старую по `last_used_at`.

---

### Requirement 4: Developer-Friendly API

**User Story:** As a Developer integrating a service, I want a clear, consistent API with proper error responses and documentation, so that I can integrate quickly without guessing.

#### Acceptance Criteria

1. THE Neo_ID SHALL возвращать все ошибки в формате `{"error": "<code>", "error_description": "<human-readable>"}` с соответствующим HTTP-статусом.
2. THE Neo_ID SHALL предоставлять endpoint `GET /api/service/userinfo` для верификации Access_Token и получения данных пользователя, принимающий Bearer-токен.
3. THE Neo_ID SHALL предоставлять endpoint `POST /api/service/verify` для верификации токена с API-ключом клиента (обратная совместимость с neomovies-api).
4. WHEN Client делает запрос к `/api/service/verify` с валидным API-ключом и токеном, THE Neo_ID SHALL возвращать `{"valid": true, "user": {...}}` с полями `unified_id`, `email`, `display_name`, `avatar`.
5. THE Neo_ID SHALL поддерживать CORS для всех `/oauth/*` и `/.well-known/*` endpoints с заголовком `Access-Control-Allow-Origin: *`.
6. THE Neo_ID SHALL поддерживать аутентификацию клиента через Basic Auth (`client_id:client_secret`) и через параметры тела запроса на `/oauth/token`.
7. THE Neo_ID SHALL предоставлять `GET /api/health` endpoint, возвращающий `{"status": "ok", "version": "<version>"}` без аутентификации.
8. WHEN запрос содержит невалидный или истёкший Access_Token, THE Neo_ID SHALL возвращать HTTP 401 с заголовком `WWW-Authenticate: Bearer realm="neo-id", error="invalid_token"`.

---

### Requirement 5: Рефакторинг фронтенда

**User Story:** As a Developer maintaining the frontend, I want the React codebase to be structured by components with proper icon library, so that it is readable and maintainable.

#### Acceptance Criteria

1. THE Dashboard SHALL использовать иконки из библиотеки `lucide-react` вместо inline SVG во всех компонентах навигации и UI.
2. THE Dashboard SHALL разделять логику по отдельным компонентам: `ProfileSection`, `SecuritySection`, `ServicesSection`, `DeveloperSection`, `SessionsSection` — каждый в отдельном файле в `src/components/sections/`.
3. THE Dashboard SHALL удалить раздел "My Sites" и кнопку "Register Site" из навигации и sidebar.
4. THE Dashboard SHALL удалить страницу `RegisterSitePage` и маршрут `/register`.
5. THE Dashboard SHALL сохранять раздел "Developer" (Service Apps / API tokens) для пользователей с ролью `developer`, `admin`, `moderator`.
6. WHEN User открывает Dashboard, THE Dashboard SHALL загружать данные профиля за не более чем 2 параллельных API-запроса.
7. THE Dashboard SHALL использовать единый `api/client.js` для всех HTTP-запросов с автоматическим добавлением Bearer-токена.
8. THE LoginPage SHALL использовать иконки из `lucide-react` вместо inline SVG для Google и GitHub кнопок.

---

### Requirement 6: Обратная совместимость с интегрированными сервисами

**User Story:** As a Developer of neomovies-api, I want existing integration to continue working after the refactor, so that I don't need to change my code.

#### Acceptance Criteria

1. THE Neo_ID SHALL сохранять endpoint `POST /api/site/verify` (принимает `{"token": "..."}` с Bearer API-ключом) и возвращать тот же формат ответа.
2. THE Neo_ID SHALL сохранять endpoint `GET /oauth/userinfo` с тем же форматом ответа.
3. THE Neo_ID SHALL сохранять endpoint `POST /api/site/login` (принимает `redirect_url`, `state`, `mode`) и возвращать `{"login_url": "..."}`.
4. THE Neo_ID SHALL сохранять endpoint `POST /api/site/user-deleted` для уведомления об удалении пользователя.
5. THE Neo_ID SHALL сохранять endpoint `GET /api/site/callback` для обратного редиректа после аутентификации.
6. WHEN neomovies-api вызывает `/api/site/verify` с валидным токеном и API-ключом, THE Neo_ID SHALL возвращать HTTP 200 с `{"valid": true, "user": {...}}`.
7. THE Neo_ID SHALL сохранять поддержку popup-режима (`mode=popup`) с postMessage для браузерных интеграций.

---

### Requirement 7: Переход на RS256 для ID Token

**User Story:** As a Developer, I want ID tokens signed with RS256 so that my service can verify them without sharing a secret, using the public JWKS endpoint.

#### Acceptance Criteria

1. THE OIDC_Provider SHALL генерировать RSA-ключевую пару при старте, если файл ключа не существует, и сохранять приватный ключ в файл или переменную окружения.
2. THE OIDC_Provider SHALL подписывать ID_Token алгоритмом RS256.
3. THE OIDC_Provider SHALL публиковать публичный ключ в формате JWK на `GET /.well-known/jwks.json` с полями `kty`, `use`, `alg`, `kid`, `n`, `e`.
4. WHEN Client верифицирует ID_Token локально, THE OIDC_Provider SHALL обеспечивать соответствие `kid` в заголовке токена и в JWKS.
5. THE OIDC_Provider SHALL поддерживать ротацию ключей: WHEN новый ключ генерируется, THE OIDC_Provider SHALL публиковать оба ключа в JWKS в течение 24 часов.
6. IF переменная окружения `RSA_PRIVATE_KEY` задана, THEN THE OIDC_Provider SHALL использовать её вместо генерации нового ключа.
