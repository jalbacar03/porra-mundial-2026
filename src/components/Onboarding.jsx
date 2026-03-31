import { useState, useEffect } from 'react'

const STORAGE_KEY = 'porra26_onboarding_seen'

const STEPS = [
  {
    icon: '⚽',
    title: 'Bienvenido a la Porra Mundial 26',
    text: 'Compite prediciendo resultados de los partidos del Mundial 2026. El que más acierte, gana.',
  },
  {
    icon: '📋',
    title: 'Tus predicciones',
    text: 'Predice los 144 partidos de fase de grupos, monta tu cuadro de eliminatorias, y responde las 10 apuestas especiales.',
  },
  {
    icon: '🏆',
    title: 'Puntuación',
    text: 'Resultado exacto = 3 pts. Signo correcto (1X2) = 1 pt. Cuadro y apuestas especiales suman puntos extra.',
  },
  {
    icon: '🔥',
    title: 'Órdagos',
    text: 'Durante el Mundial se abrirán apuestas extra sobre partidos concretos. ¡Arriesga para escalar posiciones!',
  },
]

export default function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.3s ease',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        padding: '32px 24px 24px',
        maxWidth: '360px',
        width: '100%',
        border: '1px solid var(--border)',
        textAlign: 'center',
        animation: 'slideUp 0.3s ease',
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>
          {current.icon}
        </span>
        <h2 style={{
          margin: '0 0 10px',
          fontSize: '18px',
          fontWeight: '700',
          color: 'var(--text-primary)',
        }}>
          {current.title}
        </h2>
        <p style={{
          margin: '0 0 24px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
        }}>
          {current.text}
        </p>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: i === step ? 'var(--green)' : 'var(--border)',
              transition: 'all 0.2s ease',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1,
                padding: '11px',
                background: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Atrás
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            style={{
              flex: 1,
              padding: '11px',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {isLast ? '¡Vamos!' : 'Siguiente'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={finish}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Saltar introducción
          </button>
        )}
      </div>
    </div>
  )
}
