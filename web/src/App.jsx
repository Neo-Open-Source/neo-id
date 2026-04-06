import { Routes, Route, Navigate } from 'react-router-dom'
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material'
import { ThemeProvider, useThemeMode } from './app/ThemeContext.jsx'
import { getAccessToken } from './api/client'

import LoginPage from './pages/LoginPage.jsx'
import VerifyPage from './pages/VerifyPage.jsx'
import SetupPage from './pages/SetupPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ServicesPage from './pages/ServicesPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import DocsPage from './pages/DocsPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import ConsentPage from './pages/ConsentPage.jsx'

function makeTheme(mode) {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#ffffff' : '#111111', contrastText: dark ? '#111111' : '#ffffff' },
      secondary: { main: dark ? '#aaaaaa' : '#555555' },
      background: {
        default: dark ? '#111111' : '#f5f5f5',
        paper: dark ? '#1a1a1a' : '#ffffff'
      },
      text: {
        primary: dark ? '#f0f0f0' : '#111111',
        secondary: dark ? '#888888' : '#666666',
        disabled: dark ? '#555555' : '#aaaaaa'
      },
      divider: dark ? '#2a2a2a' : '#e5e5e5',
      error: { main: '#e53935' },
      action: {
        hover: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        selected: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
      }
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'].join(','),
      h4: { fontWeight: 700, letterSpacing: '-0.5px' },
      h5: { fontWeight: 700, letterSpacing: '-0.3px' },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { background: dark ? '#111111' : '#f5f5f5' } }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}`,
            boxShadow: 'none',
            backgroundImage: 'none'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8, fontWeight: 500, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          containedPrimary: {
            backgroundColor: dark ? '#f0f0f0' : '#111111',
            color: dark ? '#111111' : '#ffffff',
            '&:hover': { backgroundColor: dark ? '#ffffff' : '#333333' },
            '&.Mui-disabled': { backgroundColor: dark ? '#2a2a2a' : '#e0e0e0', color: dark ? '#555555' : '#aaaaaa' }
          },
          outlinedPrimary: {
            borderColor: dark ? '#3a3a3a' : '#d0d0d0',
            color: dark ? '#f0f0f0' : '#111111',
            '&:hover': { borderColor: dark ? '#888888' : '#111111', backgroundColor: 'transparent' }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? '#1a1a1a' : '#ffffff',
            borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}`,
            boxShadow: 'none',
            backgroundImage: 'none'
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? '#1a1a1a' : '#ffffff',
            borderRadius: 8,
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#555555' : '#999999' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#f0f0f0' : '#111111', borderWidth: '1px' }
          },
          notchedOutline: { borderColor: dark ? '#2a2a2a' : '#d0d0d0' },
          input: { color: dark ? '#f0f0f0' : '#111111' }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { color: dark ? '#888888' : '#666666', '&.Mui-focused': { color: dark ? '#f0f0f0' : '#111111' } }
        }
      },
      MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
      MuiDivider: { styleOverrides: { root: { borderColor: dark ? '#2a2a2a' : '#e5e5e5' } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, border: '1px solid', boxShadow: 'none' },
          standardError: { backgroundColor: dark ? '#2a1515' : '#fff5f5', borderColor: dark ? '#5a2020' : '#fecaca', color: dark ? '#f87171' : '#b91c1c' },
          standardSuccess: { backgroundColor: dark ? '#0f2a1a' : '#f0fdf4', borderColor: dark ? '#1a5a30' : '#bbf7d0', color: dark ? '#4ade80' : '#15803d' },
          standardInfo: { backgroundColor: dark ? '#1a1a2a' : '#f8fafc', borderColor: dark ? '#2a2a4a' : '#e2e8f0', color: dark ? '#93c5fd' : '#475569' },
          standardWarning: { backgroundColor: dark ? '#2a1f0a' : '#fffbeb', borderColor: dark ? '#5a3a10' : '#fde68a', color: dark ? '#fbbf24' : '#92400e' }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500, color: dark ? '#888888' : '#666666', '&.Mui-selected': { color: dark ? '#f0f0f0' : '#111111' } }
        }
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: dark ? '#f0f0f0' : '#111111' } } },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 600, color: dark ? '#888888' : '#666666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}` },
          body: { borderBottom: `1px solid ${dark ? '#1f1f1f' : '#f0f0f0'}`, color: dark ? '#f0f0f0' : '#111111' }
        }
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 500 } } },
      MuiDialog: {
        styleOverrides: {
          paper: { boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.12)', border: `1px solid ${dark ? '#2a2a2a' : '#e5e5e5'}` }
        }
      },
      MuiSelect: { styleOverrides: { root: { backgroundColor: dark ? '#1a1a1a' : '#ffffff' } } },
      MuiMenuItem: { styleOverrides: { root: { color: dark ? '#f0f0f0' : '#111111' } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } }
    }
  })
}

function ThemedApp() {
  const { resolved } = useThemeMode()
  const theme = makeTheme(resolved)
  const token = getAccessToken()

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </MuiThemeProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  )
}
