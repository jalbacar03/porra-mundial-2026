import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './sentry' // Error tracking (no-op without VITE_SENTRY_DSN)
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
