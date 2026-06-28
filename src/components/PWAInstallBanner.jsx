import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'porra26_pwa_dismissed_at'
const RE_PROMPT_AFTER_DAYS = 14

/**
 * Lightweight banner suggesting the user install the PWA.
 *
 *   - Android / Desktop Chrome: captures `beforeinstallprompt` and offers a
 *     native install button.
 *   - iOS Safari: shows step-by-step instructions modal ("Compartir → Añadir
 *     a pantalla de inicio") since iOS doesn't expose the install event.
 *   - Already installed (running as standalone PWA): renders nothing.
 *   - Dismissed within the last 14 days: renders nothing.
 *
 * Why bother? Web Push background notifications on iOS only work when the
 * PWA is installed. So getting users to install = they actually receive
 * "match finished" pushes when the app is closed.
 */
export default function PWAInstallBanner() {
  const [installEvent, setInstallEvent] = useState(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Detect environment
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
  const isIOS = typeof window !== 'undefined'
    && /iPad|iPhone|iPod/.test(navigator.userAgent)
    && !window.MSStream

  useEffect(() => {
    if (isStandalone) return
    // Respect recent dismissal
    const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) || '0', 10)
    if (dismissedAt && Date.now() - dismissedAt < RE_PROMPT_AFTER_DAYS * 86400000) {
      setHidden(true)
      return
    }

    // Android / Chromium: native install prompt
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [isStandalone])

  if (isStandalone || hidden) return null
  // Show only if either: native event captured (Android) OR iOS Safari
  if (!installEvent && !isIOS) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setHidden(true)
  }

  async function handleInstall() {
    if (installEvent) {
      installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === 'accepted') {
        dismiss()
      }
      setInstallEvent(null)
    } else if (isIOS) {
      setShowIosHelp(true)
    }
  }

  return (
    <>
      <div style={{
        marginBottom: '12px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))',
        border: '1px solid rgba(37,99,235,0.25)',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <span style={{ fontSize: '22px', flexShrink: 0 }}>📱</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
            Instala la app
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Para recibir notificaciones cuando termine un partido (incluso con la app cerrada).
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={dismiss}
            style={{
              padding: '6px 10px', background: 'none',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer'
            }}
          >Después</button>
          <button
            onClick={handleInstall}
            style={{
              padding: '6px 12px', background: 'var(--green)', border: 'none',
              borderRadius: '6px', color: '#fff', fontSize: '11px',
              fontWeight: '700', cursor: 'pointer'
            }}
          >Instalar</button>
        </div>
      </div>

      {showIosHelp && (
        <div
          onClick={() => setShowIosHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)', borderRadius: '14px',
              padding: '22px 20px', maxWidth: '340px', width: '100%',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>📱</div>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center' }}>
              Instalar en iPhone
            </h3>
            <ol style={{ margin: '0 0 18px', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              <li>Pulsa el icono <strong style={{ color: 'var(--gold)' }}>Compartir</strong> (cuadrado con flecha hacia arriba) en la barra de Safari.</li>
              <li>Desplaza hacia abajo y pulsa <strong style={{ color: 'var(--gold)' }}>Añadir a pantalla de inicio</strong>.</li>
              <li>Confirma con <strong style={{ color: 'var(--gold)' }}>Añadir</strong> arriba a la derecha.</li>
              <li>Abre la app desde el icono nuevo en tu pantalla de inicio.</li>
            </ol>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', margin: '0 0 14px', lineHeight: '1.4' }}>
              Solo así recibirás notificaciones de partidos en iOS.
            </p>
            <button
              onClick={() => setShowIosHelp(false)}
              style={{
                width: '100%', padding: '10px', background: 'var(--green)',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}
            >Entendido</button>
          </div>
        </div>
      )}
    </>
  )
}
