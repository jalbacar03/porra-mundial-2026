import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../components/Toast'
import { FootballSpinner } from '../components/Skeleton'

// Comunicados oficiales (etiqueta "Avisos" en la barra).
// Feed de solo lectura para usuarios. Solo los admins publican / borran
// (la RLS de la tabla `announcements` lo refuerza server-side).
export default function Announcements({ session, isAdmin }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const toast = useToast()

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

  async function publish() {
    if (!title.trim() || !body.trim()) {
      toast?.error('Pon título y mensaje')
      return
    }
    setPosting(true)
    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      body: body.trim(),
      author_id: session?.user?.id || null,
    })
    setPosting(false)
    if (error) {
      toast?.error('No se pudo publicar')
      return
    }
    setTitle('')
    setBody('')
    toast?.success('Comunicado publicado')
    load()
  }

  async function remove(id) {
    if (!window.confirm('¿Borrar este comunicado?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { toast?.error('No se pudo borrar'); return }
    load()
  }

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

      {/* Composer — solo admins */}
      {isAdmin && (
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: '12px',
          padding: '14px', marginBottom: '16px',
          border: '1px solid rgba(255,204,0,0.25)'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: '800', color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px'
          }}>
            ✍️ Nuevo comunicado
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título"
            maxLength={120}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: '8px',
              borderRadius: '8px', border: '0.5px solid var(--border)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 700, outline: 'none', boxSizing: 'border-box'
            }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Mensaje…"
            rows={4}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: '10px',
              borderRadius: '8px', border: '0.5px solid var(--border)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: '14px', lineHeight: '1.5', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
          <button
            onClick={publish}
            disabled={posting}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: posting ? 'var(--bg-input)' : 'var(--green)',
              color: posting ? 'var(--text-muted)' : '#fff',
              fontSize: '13px', fontWeight: 700, cursor: posting ? 'not-allowed' : 'pointer',
              letterSpacing: '0.4px'
            }}
          >
            {posting ? 'Publicando…' : '📢 Publicar comunicado'}
          </button>
        </div>
      )}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <h3 style={{
                  fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)',
                  margin: 0, lineHeight: '1.3'
                }}>
                  {a.title}
                </h3>
                {isAdmin && (
                  <button
                    onClick={() => remove(a.id)}
                    aria-label="Borrar"
                    title="Borrar"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-dim)', fontSize: '16px', lineHeight: 1, padding: '2px 4px', flexShrink: 0
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
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
