import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Container, Card, CardContent, Stack, Divider, Link } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }} variant="h6">Neo ID</Typography>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 } }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Privacy Policy</Typography>
              <Typography color="text.secondary">
                Последнее обновление: {new Date().toISOString().slice(0, 10)}
              </Typography>
              <Divider />

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>1. Какие данные мы обрабатываем</Typography>
                <Typography color="text.secondary">
                  В рамках работы Neo ID могут обрабатываться:
                  <br />- email и отображаемое имя
                  <br />- идентификаторы OAuth провайдеров (например Google/GitHub)
                  <br />- технические данные сессии (IP/UA), токены сессии
                  <br />- подключенные сервисы и настройки аккаунта
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>2. Цели обработки</Typography>
                <Typography color="text.secondary">
                  Мы используем данные для:
                  <br />- аутентификации и авторизации
                  <br />- обеспечения безопасности (сессии, защита от злоупотреблений)
                  <br />- предоставления функций управления аккаунтом
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>3. Правовые основания (ориентиры)</Typography>
                <Typography color="text.secondary">
                  Мы ориентируемся на принципы минимизации данных и прозрачности. Для пользователей ЕС — на общие требования GDPR.
                  Для пользователей Молдовы — на конституционные принципы защиты прав и частной жизни и применимое национальное
                  регулирование.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>4. Сроки хранения</Typography>
                <Typography color="text.secondary">
                  Мы храним данные настолько, насколько это нужно для работы аккаунта и безопасности. Сессии имеют срок жизни и
                  могут удаляться при выходе/бане.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>5. Ваши права</Typography>
                <Typography color="text.secondary">
                  Вы можете:
                  <br />- управлять привязками OAuth провайдеров
                  <br />- менять пароль
                  <br />- запросить удаление аккаунта (если будет добавлен соответствующий процесс)
                </Typography>
              </Stack>

              <Divider />
              <Typography variant="body2" color="text.secondary">
                Дисклеймер: Этот документ носит информационный характер и не является юридической консультацией.
              </Typography>

              <Typography variant="body2" color="text.secondary">
                См. также: <Link href="/terms" underline="hover">Terms</Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
