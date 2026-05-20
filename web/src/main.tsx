import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@neo-open-source/ui-web/styles.css'
import './styles/global.css'
import App from './App'
import { consumeTokensFromHash } from './auth/oauth.js'

consumeTokensFromHash()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
