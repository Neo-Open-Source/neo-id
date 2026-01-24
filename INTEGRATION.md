# Unified ID - API Интеграции

## Концепция

Unified ID предоставляет только:
- **Аутентификацию** (OAuth + email/password)
- **Базовый профиль** (имя, аватар, email)
- **Уникальный ID** (`unified_id`) для привязки данных

Вся бизнес-логика и данные хранятся на вашем сайте.

## Регистрация сайта

1. Зарегистрируйте сайт на `https://id.neomovies.ru/register`
2. Получите `API_KEY` и `API_SECRET`
3. Настройте OAuth приложения в Google/GitHub

## Процесс авторизации

### 1. Инициация входа

```javascript
// Ваш сайт запрашивает URL для входа
const response = await fetch('https://id.neomovies.ru/api/site/login', {
    method: 'POST',
    headers: {
        'X-API-Key': 'your_api_key',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        redirect_url: 'https://neomovies.ru/auth/callback',
        state: 'random_state_string'
    })
});

const { login_url } = await response.json();
window.location.href = login_url;
```

### 2. OAuth Callback

Пользователь проходит OAuth на Unified ID и возвращается на ваш сайт:
```
https://neomovies.ru/auth/callback?token=jwt_token&state=random_state_string
```

### 3. Верификация токена

```javascript
// Верифицируйте токен и получите данные пользователя
const response = await fetch('https://id.neomovies.ru/api/site/verify', {
    method: 'POST',
    headers: {
        'X-API-Key': 'your_api_key',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        token: urlParams.get('token')
    })
});

const { valid, user } = await response.json();
if (valid) {
    // Пользователь авторизован!
    // user.unified_id - используйте для привязки данных
    // user.email, user.display_name, user.avatar - базовый профиль
}
```

## База данных на вашем сайте

```sql
-- Таблица пользователей вашего сайта
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,           -- unified_id от Unified ID
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Таблица с данными вашего сервиса (пример для NeoMovies)
CREATE TABLE user_preferences (
    user_id VARCHAR(255),                  -- unified_id
    favorite_genre VARCHAR(100),
    subscription_plan VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Пример интеграции (Node.js)

```javascript
const express = require('express');
const axios = require('axios');

const app = express();

// Конфигурация
const UNIFIED_ID_BASE = 'https://id.neomovies.ru';
const API_KEY = 'your_api_key';

// Страница входа
app.get('/login', async (req, res) => {
    const response = await axios.post(`${UNIFIED_ID_BASE}/api/site/login`, {
        redirect_url: `${req.protocol}://${req.get('host')}/auth/callback`,
        state: 'random_state'
    }, {
        headers: { 'X-API-Key': API_KEY }
    });
    
    res.redirect(response.data.login_url);
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
    try {
        const { token, state } = req.query;
        
        // Верификация токена
        const response = await axios.post(`${UNIFIED_ID_BASE}/api/site/verify`, {
            token
        }, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        const { valid, user } = response.data;
        
        if (valid) {
            // Сохраняем/обновляем пользователя в БД
            await saveOrUpdateUser(user);
            
            // Устанавливаем сессию
            req.session.userId = user.unified_id;
            req.session.user = user;
            
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?error=invalid_token');
        }
    } catch (error) {
        console.error('Auth error:', error);
        res.redirect('/login?error=auth_failed');
    }
});

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

// Защищенная страница
app.get('/dashboard', requireAuth, async (req, res) => {
    // Получаем данные пользователя из вашей БД
    const userData = await getUserData(req.session.userId);
    
    res.render('dashboard', {
        user: req.session.user,
        userData: userData  // Ваши данные сервиса
    });
});

// API для получения профиля пользователя
app.get('/api/user/profile', requireAuth, async (req, res) => {
    const userData = await getUserData(req.session.userId);
    res.json({
        unified: req.session.user,      // Данные из Unified ID
        custom: userData                // Ваши данные
    });
});

async function saveOrUpdateUser(user) {
    // Сохранение/обновление в вашей БД
    const existing = await db.query('SELECT id FROM users WHERE id = ?', [user.unified_id]);
    
    if (existing.length === 0) {
        await db.query('INSERT INTO users (id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)', 
            [user.unified_id, user.email, user.display_name, user.avatar]);
    } else {
        await db.query('UPDATE users SET email = ?, display_name = ?, avatar_url = ?, last_login = NOW() WHERE id = ?', 
            [user.email, user.display_name, user.avatar, user.unified_id]);
    }
}

async function getUserData(unifiedId) {
    // Получение ваших данных по unified_id
    return await db.query('SELECT * FROM user_preferences WHERE user_id = ?', [unifiedId]);
}
```

## JavaScript SDK (клиентская часть)

```javascript
class UnifiedID {
    constructor(apiKey, baseUrl = 'https://id.neomovies.ru') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    
    async login(redirectUrl) {
        const state = this.generateState();
        localStorage.setItem('unified_id_state', state);
        
        const response = await fetch(`${this.baseUrl}/api/site/login`, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                redirect_url: redirectUrl,
                state: state
            })
        });
        
        const data = await response.json();
        window.location.href = data.login_url;
    }
    
    async handleCallback(token, state) {
        const savedState = localStorage.getItem('unified_id_state');
        if (state !== savedState) {
            throw new Error('Invalid state');
        }
        
        const response = await fetch(`${this.baseUrl}/api/site/verify`, {
            method: 'POST',
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        if (data.valid) {
            localStorage.setItem('unified_id_user', JSON.stringify(data.user));
            localStorage.removeItem('unified_id_state');
            return data.user;
        }
        
        throw new Error('Invalid token');
    }
    
    getCurrentUser() {
        const userStr = localStorage.getItem('unified_id_user');
        return userStr ? JSON.parse(userStr) : null;
    }
    
    logout() {
        localStorage.removeItem('unified_id_user');
        localStorage.removeItem('unified_id_state');
    }
    
    generateState() {
        return Math.random().toString(36).substring(2, 15);
    }
}

// Использование
const unifiedID = new UnifiedID('your_api_key');

// Вход
document.getElementById('loginBtn').onclick = () => {
    unifiedID.login(window.location.origin + '/auth/callback');
};

// Обработка callback
if (window.location.pathname === '/auth/callback') {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const state = params.get('state');
    
    if (token && state) {
        unifiedID.handleCallback(token, state)
            .then(user => {
                window.location.href = '/dashboard';
            })
            .catch(error => {
                console.error('Auth error:', error);
                window.location.href = '/login?error=auth_failed';
            });
    }
}
```

## Безопасность

1. **Всегда проверяйте `state` параметр** для защиты от CSRF
2. **Храните API ключ в безопасности** на сервере
3. **Используйте HTTPS** в production
4. **Валидируйте токены** на каждом запросе
5. **Ограничьте время жизни сессий**

## Преимущества

- ✅ **Единый вход** для всех ваших сервисов
- ✅ **Надежная OAuth** аутентификация
- ✅ **Минимальная интеграция** - только API вызовы
- ✅ **Полный контроль** над данными пользователей
- ✅ **Масштабируемость** - легко добавить новые сервисы

## Поддержка

- Документация: https://docs.unified-id.ru
- API Reference: https://api.unified-id.ru/docs
- Поддержка: support@unified-id.ru
