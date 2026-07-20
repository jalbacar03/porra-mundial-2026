import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { FootballSpinner } from './Skeleton'

/**
 * MODO ARCHIVO — pantalla única de cierre del torneo.
 *
 * Se muestra a todo el mundo (excepto admin, o con ?staff=1) cuando
 * app_config.archived_mode = true. Sustituye a la app ENTERA: no hay navegación,
 * ni rutas, ni enlaces a otras pantallas. Solo la clasificación definitiva.
 *
 * Objetivo: dejar la porra como archivo consultable sin exponer el resto del
 * producto. Toggle por SQL, sin redeploy:
 *   update app_config set archived_mode = false where id = 1;   -- vuelve la app
 *
 * Nota: solo lee la vista `leaderboard` (nombre + puntos + exactos). No toca
 * predicciones, especiales ni ninguna otra tabla.
 */
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

const MEDALLA = ['#ffcc00', '#c8ccd4', '#cd8246', '#9a8456', '#9a8456']

export default function TournamentClosed() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: lb }, { data: profs }] = await Promise.all([
        supabase.from('leaderboard').select('user_id, full_name, total_points, exact_hits'),
        supabase.from('profiles').select('id, has_paid'),
      ])
      const paid = new Set((profs || []).filter(p => p.has_paid).map(p => p.id))
      const list = (lb || [])
        .filter(r => paid.has(r.user_id) && r.user_id !== BOT365_ID)
        // Orden oficial de las normas: puntos y, a igualdad, más resultados exactos.
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0)
          || (b.exact_hits || 0) - (a.exact_hits || 0))
      if (alive) setRows(list)
    })()
    return () => { alive = false }
  }, [])

  return (
    <div style={{
      minHeight: '100svh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 40px'
    }}>
      {/* Franja rojigualda: España campeona */}
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '8px', zIndex: 10,
        background: 'linear-gradient(180deg, #c60b1e 0 25%, #ffc400 25% 75%, #c60b1e 75% 100%)'
      }} />

      <div style={{ width: '100%', maxWidth: '520px', paddingTop: '48px' }}>

        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)',
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '18px'
          }}>
            Porra Mundial <span style={{ color: 'var(--gold)' }}>26</span>
          </div>
          <h1 style={{
            fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)',
            margin: '0 0 10px', letterSpacing: '-0.4px'
          }}>
            La porra ha terminado
          </h1>
          <p style={{
            fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0
          }}>
            España campeona del mundo. Gracias a todos por participar.
          </p>
        </div>

        {/* Clasificación */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '14px',
          border: '0.5px solid var(--border)', overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
            letterSpacing: '1.4px', textTransform: 'uppercase'
          }}>
            Clasificación final
          </div>

          {rows === null ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <FootballSpinner size={30} />
            </div>
          ) : (
            <div>
              {rows.map((r, i) => {
                const pos = i + 1
                const top = pos <= 5
                return (
                  <div key={r.user_id} style={{
                    display: 'grid',
                    gridTemplateColumns: '34px 1fr auto',
                    alignItems: 'center', gap: '8px',
                    padding: '10px 16px',
                    background: top ? 'rgba(var(--accent-rgb),0.07)' : 'transparent',
                    borderBottom: i === rows.length - 1 ? 'none' : '0.5px solid var(--border-light)'
                  }}>
                    <span style={{
                      fontSize: '13px', fontWeight: '800',
                      color: top ? MEDALLA[pos - 1] : 'var(--text-dim)'
                    }}>
                      {pos}
                    </span>
                    <span style={{
                      fontSize: '14px', fontWeight: top ? '700' : '500',
                      color: top ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {r.full_name}
                    </span>
                    <span style={{
                      fontSize: '14px', fontWeight: '800',
                      color: top ? 'var(--gold)' : 'var(--text-primary)'
                    }}>
                      {r.total_points}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p style={{
          textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)',
          marginTop: '20px', lineHeight: '1.6'
        }}>
          Mundial 2026 · 11 junio – 19 julio<br />
          {rows ? `${rows.length} participantes` : ''}
        </p>
      </div>
    </div>
  )
}
