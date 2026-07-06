import { useState } from 'react'
import { supabase } from '../supabase'

// Descarga en Excel las predicciones de todos los participantes (backup/transparencia).
// Se genera al vuelo en /api/export-predictions (siempre actualizado). Solo incluye
// rondas ya cerradas — nunca expone una ronda con el plazo abierto.
export default function DownloadPredictions() {
  const [loading, setLoading] = useState(null)

  async function download(tipo) {
    setLoading(tipo)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { alert('Inicia sesión para descargar.'); return }
      const res = await fetch(`/api/export-predictions?tipo=${tipo}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { alert('No se pudo generar el Excel. Inténtalo de nuevo.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = tipo === 'pre' ? 'porra_predicciones_pre_mundial.xlsx' : 'porra_predicciones_eliminatorias.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('No se pudo generar el Excel. Inténtalo de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const btn = (tipo, emoji, title, sub) => (
    <button onClick={() => download(tipo)} disabled={loading !== null} className="tap-scale"
      style={{
        flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 14px', borderRadius: '10px', textAlign: 'left',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', cursor: loading ? 'default' : 'pointer',
        opacity: loading && loading !== tipo ? 0.5 : 1,
      }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>
          {loading === tipo ? 'Generando…' : title}
        </span>
        <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>{sub}</span>
      </span>
    </button>
  )

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
        📥 Descargar predicciones (Excel)
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
        Copia de lo que ha puesto cada participante, como respaldo y transparencia. Solo incluye
        rondas ya cerradas.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {btn('pre', '📋', 'Antes del Mundial', 'Grupos · Cuadro ciego · Especiales')}
        {btn('elim', '🏆', 'Eliminatorias', 'Una hoja por ronda (dieciseisavos, octavos…)')}
      </div>
    </div>
  )
}
