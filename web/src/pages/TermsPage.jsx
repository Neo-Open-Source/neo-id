import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Container, Card, CardContent, Stack, Divider, Link } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function TermsPage() {
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
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Terms</Typography>
              <Typography color="text.secondary">
                Последнее обновление: {new Date().toISOString().slice(0, 10)}
              </Typography>
              <Divider />

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>1. Общие положения</Typography>
                <Typography color="text.secondary">
                  Neo ID — сервис аутентификации и управления идентификацией пользователей. Используя Neo ID, вы соглашаетесь с
                  настоящими условиями.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>2. Принципы и уважение прав</Typography>
                <Typography color="text.secondary">
                  Мы проектируем сервис так, чтобы уважать права и свободы человека, включая право на личную жизнь и защиту
                  персональных данных. В качестве ориентиров мы опираемся на общепризнанные принципы, включая:
                </Typography>
                <Typography color="text.secondary">
                  - Всеобщую декларацию прав человека (UDHR)
                  <br />- Европейскую правовую рамку по защите данных (включая GDPR)
                  <br />- конституционные принципы Республики Молдова, относящиеся к правам человека и неприкосновенности частной жизни.
                </Typography>
                <Typography color="text.secondary">
                  Это описание принципов, а не юридическое заключение.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>3. Аккаунт и безопасность</Typography>
                <Typography color="text.secondary">
                  Вы несёте ответственность за безопасность своего аккаунта и за сохранность токенов/паролей. Не передавайте
                  секреты третьим лицам.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>4. Запрещённое использование</Typography>
                <Typography color="text.secondary">
                  Запрещается использовать сервис для незаконной деятельности, обхода ограничений безопасности, взлома,
                  распространения вредоносного ПО, а также для действий, нарушающих права других лиц.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>5. Доступность сервиса</Typography>
                <Typography color="text.secondary">
                  Мы стремимся обеспечивать стабильную работу, но не гарантируем непрерывную доступность. Мы можем изменять,
                  приостанавливать или прекращать отдельные функции.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>6. Изменения условий</Typography>
                <Typography color="text.secondary">
                  Мы можем обновлять условия. Продолжая использование после обновления, вы соглашаетесь с новой версией.
                </Typography>
              </Stack>

              <Divider />
              <Typography variant="body2" color="text.secondary">
                Дисклеймер: Этот документ носит информационный характер и не является юридической консультацией.
                Если вам нужен юридически выверенный документ под Молдову/ЕС, лучше согласовать финальный текст с юристом.
              </Typography>

              <Typography variant="body2" color="text.secondary">
                См. также: <Link href="/privacy" underline="hover">Privacy Policy</Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
