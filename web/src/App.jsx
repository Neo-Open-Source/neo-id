import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RegisterSitePage from './pages/RegisterSitePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f97316'
    },
    background: {
      default: '#070a0f',
      paper: 'rgba(255,255,255,0.06)'
    }
  },
  shape: {
    borderRadius: 12
  },
  typography: {
    fontFamily: [
      'Inter',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Arial',
      'sans-serif'
    ].join(',')
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'radial-gradient(1200px 800px at 20% 10%, rgba(249,115,22,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(99,102,241,0.14), transparent 55%)',
          backgroundAttachment: 'fixed'
        },
        '*': {
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        },
        '*::-webkit-scrollbar': {
          width: 0,
          height: 0
        },
        'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus': {
          WebkitTextFillColor: '#ffffff',
          WebkitBoxShadow: '0 0 0px 1000px rgba(255,255,255,0.04) inset',
          transition: 'background-color 9999s ease-in-out 0s'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          backdropFilter: 'blur(10px)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          backdropFilter: 'blur(12px)'
        }
      }
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 64
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 10
        },
        notchedOutline: {
          borderColor: 'rgba(255,255,255,0.12)'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.72)'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true
      }
    },
    MuiContainer: {
      defaultProps: {
        disableGutters: false
      }
    }
  }
})

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/register" element={<RegisterSitePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ThemeProvider>
  )
}
