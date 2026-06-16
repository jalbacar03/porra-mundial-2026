import { supabase } from '../supabase'

/**
 * Pantalla bloqueante de "acceso en revisión".
 *
 * Se muestra a usuarios cuyo acceso está pausado por el organizador (lista fija
 * en App.jsx). Bloquea TODA la app — el usuario no ve ni puede hacer nada hasta
 * que el admin lo reactive. Texto neutro: validación de acceso, sin mención a
 * dinero ni pagos (la app no procesa pagos).
 */
export default function AccessBlocked() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', background: 'var(--bg-primary, #1a1d26)'
    }}>
      <div style={{
        width: '100%', maxWidth: '360px',
        background: 'linear-gradient(165deg, #2a1520, #1e1018, #1a0e14)',
        borderRadius: '14px',
        border: '1px solid rgba(160, 60, 80, 0.25)',
        padding: '34px 26px 26px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(120, 40, 60, 0.08)',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,60,80,0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(160, 60, 80, 0.15)',
          border: '1px solid rgba(160, 60, 80, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '26px'
        }}>
          🔒
        </div>

        <h3 style={{
          fontSize: '17px', fontWeight: '700', color: '#f0e4e8',
          margin: '0 0 6px', letterSpacing: '0.2px'
        }}>
          Acceso en revisión
        </h3>

        <p style={{
          fontSize: '13px', color: 'rgba(220, 190, 200, 0.6)',
          margin: '0 0 22px', lineHeight: '1.55'
        }}>
          Tu acceso a la porra está pendiente de validación por el organizador.
          En cuanto lo confirme, podrás entrar con normalidad.
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
          padding: '16px', border: '0.5px solid rgba(160, 60, 80, 0.15)',
          marginBottom: '22px'
        }}>
          <div style={{ fontSize: '12.5px', color: 'rgba(220,190,200,0.7)', lineHeight: '1.55' }}>
            Sigues dentro de la porra y en la clasificación. Si crees que es un
            error, contacta con el administrador.
          </div>
        </div>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(220,190,200,0.4)', fontSize: '12.5px',
            cursor: 'pointer', textDecoration: 'underline', padding: '4px'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
