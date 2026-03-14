import { useState } from 'react'
import { supabase } from '../supabase'

export default function PaymentWall() {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'rgba(10, 8, 12, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'linear-gradient(165deg, #2a1520, #1e1018, #1a0e14)',
        borderRadius: '14px',
        border: '1px solid rgba(160, 60, 80, 0.25)',
        padding: '32px 26px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(120, 40, 60, 0.08)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Sutil brillo decorativo en esquina */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,60,80,0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {!confirmed ? (
          <>
            {/* Estado: Pendiente de pago */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(160, 60, 80, 0.15)',
              border: '1px solid rgba(160, 60, 80, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '26px'
            }}>
              🔒
            </div>

            <h3 style={{
              fontSize: '17px',
              fontWeight: '700',
              color: '#f0e4e8',
              margin: '0 0 6px',
              letterSpacing: '0.2px'
            }}>
              Inscripción pendiente
            </h3>

            <p style={{
              fontSize: '13px',
              color: 'rgba(220, 190, 200, 0.55)',
              margin: '0 0 24px',
              lineHeight: '1.5'
            }}>
              Para acceder a la porra, completa el pago de inscripción.
            </p>

            {/* Tarjeta con datos de pago */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
              padding: '18px 16px',
              border: '0.5px solid rgba(160, 60, 80, 0.15)',
              textAlign: 'left',
              marginBottom: '22px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                paddingBottom: '12px',
                borderBottom: '0.5px solid rgba(160, 60, 80, 0.12)'
              }}>
                <span style={{ fontSize: '12px', color: 'rgba(220,190,200,0.45)' }}>
                  Cuota de inscripción
                </span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f0e4e8' }}>
                  25 €
                </span>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(220,190,200,0.4)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Método
                </div>
                <div style={{ fontSize: '14px', color: '#f0e4e8', fontWeight: '500' }}>
                  Bizum
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(220,190,200,0.4)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Enviar a
                </div>
                <div style={{ fontSize: '14px', color: '#f0e4e8', fontWeight: '500' }}>
                  Número por confirmar
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'rgba(220,190,200,0.4)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Concepto
                </div>
                <div style={{ fontSize: '14px', color: '#f0e4e8', fontWeight: '500' }}>
                  Porra Mundial 26 + tu nombre
                </div>
              </div>
            </div>

            {/* Botón "Ya he pagado" */}
            <button
              onClick={() => setConfirmed(true)}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #8b2040, #6b1830)',
                color: '#f0e4e8',
                border: '1px solid rgba(160, 60, 80, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '0.3px',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              Ya he pagado
            </button>

            {/* Cerrar sesión */}
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(220,190,200,0.35)',
                fontSize: '12px',
                cursor: 'pointer',
                marginTop: '16px',
                padding: '4px 8px'
              }}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            {/* Estado: Pago enviado, esperando confirmación */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(160, 60, 80, 0.15)',
              border: '1px solid rgba(160, 60, 80, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '26px'
            }}>
              ✓
            </div>

            <h3 style={{
              fontSize: '17px',
              fontWeight: '700',
              color: '#f0e4e8',
              margin: '0 0 6px',
              letterSpacing: '0.2px'
            }}>
              ¡Gracias!
            </h3>

            <p style={{
              fontSize: '13px',
              color: 'rgba(220, 190, 200, 0.55)',
              margin: '0 0 24px',
              lineHeight: '1.6'
            }}>
              Estamos revisando tu pago. En cuanto lo confirmemos, tendrás acceso completo a la porra. Normalmente tarda menos de 24 horas.
            </p>

            {/* Indicador de "en proceso" */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
              padding: '16px',
              border: '0.5px solid rgba(160, 60, 80, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '22px'
            }}>
              {/* Dot pulsante */}
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#c0a050',
                flexShrink: 0,
                animation: 'pulse 2s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '13px', color: 'rgba(220,190,200,0.5)' }}>
                Pago pendiente de revisión
              </span>
            </div>

            {/* Cerrar sesión */}
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(220,190,200,0.35)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Cerrar sesión
            </button>

            {/* Animación CSS para el dot pulsante */}
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  )
}