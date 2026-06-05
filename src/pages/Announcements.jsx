import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { FootballSpinner } from '../components/Skeleton'

// Comunicados oficiales (etiqueta "Avisos" en la barra).
// Feed de SOLO LECTURA para todos. No hay editor en la app: los comunicados
// se publican fuera de banda (vía SQL/Claude). La RLS solo permite escritura
// al owner de todos modos.
export default function Announcements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Realtime: nuevos avisos aparecen sin recargar.
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function fmtDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{
          fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)',
          margin: 0, letterSpacing: '-0.5px'
        }}>
          Comunicados oficiales
        </h2>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '4px' }}>
          Avisos de la organización
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <FootballSpinner text="Cargando comunicados…" />
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '50px 20px',
          color: 'var(--text-muted)', fontSize: '14px'
        }}>
          📭 Aún no hay comunicados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map(a => (
            <div key={a.id} style={{
              background: 'var(--bg-secondary)', borderRadius: '12px',
              padding: '14px 16px', border: '0.5px solid var(--border)',
              borderLeft: '3px solid var(--gold)'
            }}>
              <h3 style={{
                fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)',
                margin: 0, lineHeight: '1.3'
              }}>
                {a.title}
              </h3>
              <div style={{
                fontSize: '14px', color: 'var(--text-secondary, #c8ccd4)',
                lineHeight: '1.55', marginTop: '8px', whiteSpace: 'pre-wrap'
              }}>
                {a.body}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '10px' }}>
                {fmtDate(a.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
