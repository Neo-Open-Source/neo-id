import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './app/ThemeContext'
import { getAccessToken } from './api/client'

import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import VerifyPage from './pages/VerifyPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import DeveloperPage from './pages/DeveloperPage'
import ServicesPage from './pages/ServicesPage'
import AdminPage from './pages/AdminPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ConsentPage from './pages/ConsentPage'
import TwoFAPage from './pages/TwoFAPage'
import DeviceLoginPage from './pages/DeviceLoginPage'

const DocsPage = lazy(() => import('./pages/DocsPage'))

function AppRoutes() {
  const token = getAccessToken()
  return (
    <Routes>
      <Route path="/" element={token ? <HomePage /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/2fa" element={<TwoFAPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/developer" element={<DeveloperPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/docs" element={<Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading docs…</div>}><DocsPage /></Suspense>} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/tv" element={<DeviceLoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  )
}
