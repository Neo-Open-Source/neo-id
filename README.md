# Unified ID

Единый сервис авторизации для экосистемы NeoMovies и других сайтов.

## Стек

- **Backend**: Go + Beego
- **DB**: MongoDB
- **Web**: React (Vite) в `web/`

## Быстрый старт (локально)

### 1) Конфиг

Настройки лежат в `conf/app.conf`.

Важно:

- `httpport` сейчас = `8081` (значит URL: `http://localhost:8081`)
- `base_url` должен соответствовать домену/порту, где реально крутится сервис
- `mongodb_uri` обязателен

### 2) Backend

```bash
go mod tidy
go run .
```

### 3) Frontend

```bash
cd web
npm i
npm run dev
```

## Основные роуты

### Auth

- `GET /api/auth/login/:provider`
- `GET /api/auth/callback/:provider`
- `POST /api/auth/password/login`
- `POST /api/auth/password/register`
- `GET /api/auth/verify-email`
- `POST /api/auth/verify-email/code`
- `POST /api/auth/verify-email/resend`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`

### User

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `GET /api/user/providers`
- `POST /api/user/provider/unlink`
- `POST /api/user/password/set`
- `GET /api/user/services`
- `POST /api/user/services/connect`
- `POST /api/user/services/disconnect`
- `GET /api/user/service-apps`
- `POST /api/user/service-apps`
- `POST /api/user/service-apps/revoke`
- `POST /api/user/service-apps/delete`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/users/ban`
- `POST /api/admin/users/unban`
- `POST /api/admin/users/role`
- `GET /api/admin/services`
- `POST /api/admin/services`
- `GET /api/admin/sites`

### Site (SaaS модель)

- `POST /api/site/register`
- `POST /api/site/login`
- `GET /api/site/callback`
- `POST /api/site/verify`
- `GET /api/site/info`
- `GET /api/site/my`

### Legacy service integration

- `POST /api/service/verify`
- `GET /api/service/userinfo`

## TODO
- [ ] Нормальное логирование + аудит действий админа
- [ ] Rate limiting на auth endpoints
- [ ] MFA/2FA (TOTP)
- [ ] Улучшить CORS/allowed origins (шаблоны + отдельные окружения)
- [ ] Тесты для auth flows (register/login/verify/refresh)

## Лицензия

[MIT](LICENSE)
