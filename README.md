# Unified ID Service

Единый сервис авторизации для NeoMovies, NeoMe и других сервисов с поддержкой OAuth провайдеров (Google, GitHub, Яндекс, ВК).

## Архитектура

- **Backend**: Go с Beego framework
- **Database**: MongoDB
- **Frontend**: HTML/CSS/JavaScript с TailwindCSS
- **Deployment**: Vercel
- **Authentication**: JWT + OAuth 2.0

## Структура проекта

```
unified-id/
├── main.go                 # Точка входа
├── go.mod                  # Зависимости
├── conf/
│   └── app.conf           # Конфигурация
├── controllers/
│   ├── auth.go            # OAuth авторизация
│   ├── user.go            # Управление профилем
│   ├── admin.go           # Админ функции
│   ├── service.go         # API для сервисов
│   └── dashboard.go       # Dashboard
├── models/
│   ├── database.go        # Подключение к MongoDB
│   ├── user.go            # Модель пользователя
│   └── session.go         # Сессии и сервисы
├── routers/
│   └── routes.go          # Роуты API
└── views/
    └── dashboard.html     # Frontend dashboard
```

## Установка и запуск

### 1. Клонирование и зависимости

```bash
git clone <repository>
cd unified-id
go mod tidy
```

### 2. Настройка MongoDB

```bash
# Запуск MongoDB (Docker)
docker run -d -p 27017:27017 --name mongodb mongo

# Или установка локально
# https://docs.mongodb.com/manual/installation/
```

### 3. Конфигурация

Отредактируйте `conf/app.conf`:

```ini
# JWT секрет
jwt_secret = "your-super-secret-jwt-key-change-in-production"

# OAuth приложения Google
google_client_id = "your-google-client-id"
google_client_secret = "your-google-client-secret"

# OAuth приложение GitHub  
github_client_id = "your-github-client-id"
github_client_secret = "your-github-client-secret"

# MongoDB
mongodb_uri = "mongodb://localhost:27017"

# Администраторы
admin_emails = "admin@unified-id.com"
```

### 4. OAuth настройка

#### Google OAuth
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новое приложение
3. Добавьте OAuth 2.0 Client ID
4. Redirect URI: `http://localhost:8080/api/auth/callback?provider=google`

#### GitHub OAuth
1. Перейдите в [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Создайте новое OAuth App
3. Authorization callback URL: `http://localhost:8080/api/auth/callback?provider=github`

### 5. Запуск

```bash
# Разработка
go run main.go

# Production
go build -o unified-id
./unified-id
```

Сервис будет доступен на `http://localhost:8080`

## API Эндпоинты

### Аутентификация
- `GET /api/auth/login?provider={google|github}` - Начало OAuth
- `GET /api/auth/callback?provider={google|github}` - OAuth callback
- `POST /api/auth/logout` - Выход
- `POST /api/auth/refresh` - Обновление токена

### Пользователь
- `GET /api/user/profile` - Получить профиль
- `PUT /api/user/profile` - Обновить профиль
- `GET /api/user/services` - Подключенные сервисы
- `POST /api/user/services/connect` - Подключить сервис
- `POST /api/user/services/disconnect` - Отключить сервис

### Админ
- `GET /api/admin/users` - Список пользователей
- `POST /api/admin/users/ban` - Забанить пользователя
- `POST /api/admin/users/unban` - Разбанить пользователя
- `GET /api/admin/services` - Список сервисов
- `POST /api/admin/services` - Создать сервис

### Для сервисов
- `POST /api/service/verify` - Верификация токена
- `GET /api/service/userinfo` - Информация о пользователе

## Интеграция с сервисами

### NeoMovies/NeoMe

1. Получите сервисный токен у администратора
2. Используйте API эндпоинты для верификации пользователей:

```javascript
// Верификация токена пользователя
const response = await fetch('/api/service/verify', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer neomovies_secret_token',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        user_token: 'user_jwt_token'
    })
});

const userData = await response.json();
if (userData.valid) {
    // Пользователь авторизован
    console.log(userData.user);
}
```

## Развертывание на Vercel

1. Создайте `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "main.go",
      "use": "@vercel/go"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/main.go"
    }
  ],
  "env": {
    "MONGODB_URI": "@mongodb_uri",
    "JWT_SECRET": "@jwt_secret",
    "GOOGLE_CLIENT_ID": "@google_client_id",
    "GOOGLE_CLIENT_SECRET": "@google_client_secret",
    "GITHUB_CLIENT_ID": "@github_client_id",
    "GITHUB_CLIENT_SECRET": "@github_client_secret"
  }
}
```

2. Развертывание:

```bash
vercel --prod
```

## Безопасность

- JWT токены с истечением срока действия
- OAuth 2.0 с state параметром
- HTTPS в production
- Валидация входных данных
- Rate limiting (рекомендуется добавить)

## TODO

- [ ] Добавить Яндекс и ВК OAuth
- [ ] Rate limiting
- [ ] Email верификация
- [ ] 2FA/MFA
- [ ] Логирование и аудит
- [ ] Кэширование
- [ ] Мультиязычность

## Лицензия

MIT License
