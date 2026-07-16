import { FootballSpinner } from './Skeleton'

/**
 * Pantalla de mantenimiento. Se muestra a todo el mundo (excepto admin, o con
 * ?staff=1) cuando app_config.maintenance_mode = true. Toggle por SQL, sin redeploy.
 *
 * El titular es perenne a propósito: el detalle concreto va en
 * app_config.maintenance_message, que sí se cambia sin tocar código. (Antes decía
 * "Cerrando la fase de grupos" fijo, y seguía ahí en plena final.)
 */
export default function MaintenanceScreen({ message }) {
  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '24px',
      background: 'var(--bg-primary, #1a1d26)'
    }}>
      <div style={{
        fontSize: '11px', fontWeight: '700', color: 'var(--text-dim, #6f747f)',
        letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '24px'
      }}>
        Porra Mundial <span style={{ color: 'var(--gold, #ffcc00)' }}>26</span>
      </div>

      <FootballSpinner size={44} />

      <h1 style={{
        fontSize: '20px', fontWeight: '800', color: 'var(--text-primary, #fff)',
        margin: '24px 0 10px', letterSpacing: '-0.3px'
      }}>
        Volvemos enseguida
      </h1>

      <p style={{
        fontSize: '14px', color: 'var(--text-muted, #8a8f99)', lineHeight: '1.6',
        maxWidth: '320px', margin: 0
      }}>
        {message || 'Estamos haciendo ajustes en la app. Vuelve en un rato.'}
      </p>

      <div style={{
        marginTop: '28px', fontSize: '12px', color: 'var(--text-dim, #6f747f)'
      }}>
        Gracias por la paciencia
      </div>
    </div>
  )
}
