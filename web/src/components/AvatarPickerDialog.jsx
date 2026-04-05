import { useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, Button, Avatar, IconButton, Alert
} from '@mui/material'
import { uploadAvatar, setAvatarStock, STOCK_AVATARS } from '../api/endpoints'

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

export default function AvatarPickerDialog({ open, currentAvatar, displayName, onClose, onSaved }) {
  const fileRef = useRef()
  const [selected, setSelected] = useState('')
  const [previewURL, setPreviewURL] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const preview = previewURL || selected || currentAvatar || ''

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setSelected('')
    setPreviewURL(URL.createObjectURL(file))
  }

  const onSelectStock = (url) => {
    setSelected(url)
    setPreviewURL(url)
    setUploadFile(null)
  }

  const onSave = async () => {
    if (!uploadFile && !selected) { onClose(); return }
    setLoading(true)
    setError('')
    try {
      let data
      if (uploadFile) {
        data = await uploadAvatar(uploadFile)
      } else {
        data = await setAvatarStock(selected)
      }
      onSaved(data.avatar)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update avatar')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelected('')
    setPreviewURL('')
    setUploadFile(null)
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', pb: 1 }}>Change profile picture</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

          {/* Preview */}
          <Stack alignItems="center">
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Avatar
                src={preview}
                imgProps={{ referrerPolicy: 'no-referrer', crossOrigin: 'anonymous' }}
                sx={{
                  width: 88, height: 88,
                  bgcolor: 'action.selected', color: 'text.primary',
                  fontSize: '2rem',
                  border: '2px solid', borderColor: preview ? 'text.primary' : 'divider'
                }}
              >
                {!preview && (displayName || '?')[0]?.toUpperCase()}
              </Avatar>
              <IconButton
                onClick={() => fileRef.current?.click()}
                size="small"
                sx={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 26, height: 26,
                  bgcolor: 'background.paper',
                  border: '1px solid', borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <CameraIcon />
              </IconButton>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Click the camera icon to upload your own
            </Typography>
          </Stack>

          {/* Stock grid */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
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
                    borderColor: selected === url ? 'text.primary' : 'transparent',
                    transition: 'border-color 0.15s',
                    '&:hover': { borderColor: 'text.secondary' }
                  }}
                >
                  <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          size="small"
          variant="contained"
          disabled={loading || (!uploadFile && !selected)}
          onClick={onSave}
          sx={{ px: 2.5 }}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
