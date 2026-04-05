import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, Stack, Typography, TextField, Button, Alert, Avatar, IconButton } from '@mui/material'
import { completeProfile, uploadAvatar, STOCK_AVATARS } from '../api/endpoints'
import { getAccessToken } from '../api/client'
import ThemeToggle from '../components/ThemeToggle.jsx'

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

export default function SetupPage() {
  const navigate = useNavigate()
  const fileRef = useRef()

  const [step, setStep] = useState(1) // 1 = avatar, 2 = name
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [previewURL, setPreviewURL] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!getAccessToken()) { navigate('/login'); return null }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setSelectedAvatar('')
    setPreviewURL(URL.createObjectURL(file))
  }

  const onSelectStock = (url) => {
    setSelectedAvatar(url)
    setPreviewURL(url)
    setUploadFile(null)
  }

  const onFinish = async () => {
    if (!displayName.trim()) { setError('Please enter your name'); return }
    setLoading(true)
    setError('')
    try {
      let avatarURL = selectedAvatar
      if (uploadFile) {
        const data = await uploadAvatar(uploadFile)
        avatarURL = data.avatar
      }
      await completeProfile(displayName.trim(), avatarURL)
      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const avatar = previewURL || selectedAvatar

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ position: 'fixed', top: 16, right: 16 }}><ThemeToggle /></Box>
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>

            {/* Progress */}
            <Stack direction="row" spacing={0.75}>
              {[1, 2].map((s) => (
                <Box key={s} sx={{ height: 3, flex: 1, borderRadius: 2, bgcolor: s <= step ? 'text.primary' : 'divider', transition: 'background-color 0.3s' }} />
              ))}
            </Stack>

            {/* Step 1 — Avatar */}
            {step === 1 && (
              <Stack spacing={3}>
                <Stack spacing={0.5}>
                  <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    Set up your profile picture
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Upload a photo or choose one below
                  </Typography>
                </Stack>

                <Stack alignItems="center">
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <Avatar
                      src={avatar || ''}
                      sx={{ width: 96, height: 96, bgcolor: 'action.selected', color: 'text.primary', fontSize: '2.5rem', border: '2px solid', borderColor: avatar ? 'text.primary' : 'divider' }}
                    >
                      {!avatar && '?'}
                    </Avatar>
                    <IconButton
                      onClick={() => fileRef.current?.click()}
                      size="small"
                      sx={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <CameraIcon />
                    </IconButton>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                  </Box>
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                    Or choose an avatar
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                    {STOCK_AVATARS.map((url) => (
                      <Box
                        key={url}
                        onClick={() => onSelectStock(url)}
                        sx={{
                          aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                          border: '2.5px solid',
                          borderColor: selectedAvatar === url ? 'text.primary' : 'transparent',
                          transition: 'border-color 0.15s',
                          '&:hover': { borderColor: 'text.secondary' }
                        }}
                      >
                        <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </Box>
                    ))}
                  </Box>
                </Stack>

                <Stack spacing={1}>
                  <Button variant="contained" fullWidth onClick={() => setStep(2)} sx={{ height: 42 }}>
                    Next
                  </Button>
                  {/* Avatar can be skipped */}
                  <Button variant="text" fullWidth onClick={() => setStep(2)} sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    Skip
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* Step 2 — Name (required) */}
            {step === 2 && (
              <Stack spacing={3}>
                <Box component="button" onClick={() => setStep(1)} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: 'text.secondary', fontSize: '0.875rem', p: 0, textAlign: 'left', width: 'fit-content' }}>
                  ← Back
                </Box>

                <Stack spacing={0.5}>
                  <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    What's your name?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This is how you'll appear to others
                  </Typography>
                </Stack>

                {avatar && (
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar src={avatar} sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>Looking good</Typography>
                  </Stack>
                )}

                {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

                <TextField
                  label="Display name"
                  size="small"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && onFinish()}
                />

                {/* Name is required — no skip */}
                <Button
                  variant="contained"
                  fullWidth
                  disabled={loading || !displayName.trim()}
                  onClick={onFinish}
                  sx={{ height: 42 }}
                >
                  {loading ? 'Saving...' : 'Finish'}
                </Button>
              </Stack>
            )}

          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
