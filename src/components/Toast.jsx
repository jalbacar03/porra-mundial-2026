import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const COLORS = {
  success: { bg: 'rgba(0,122,69,0.95)', border: 'var(--green)', icon: '✓' },
  error: { bg: 'rgba(226,75,74,0.95)', border: 'var(--red)', icon: '✕' },
  info: { bg: 'rgba(34,37,47,0.95)', border: 'var(--border)', icon: 'ℹ' },
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '90%',
      maxWidth: '400px',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info
        return (
          <div
            key={t.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              animation: t.exiting ? 'toastOut 0.3s ease forwards' : 'toastIn 0.3s ease',
              pointerEvents: 'auto',
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              flexShrink: 0,
            }}>
              {c.icon}
            </span>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500', lineHeight: '1.4' }}>
              {t.message}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, exiting: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 300)
    }, duration)
  }, [])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 4000),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}
