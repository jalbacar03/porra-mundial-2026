import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Avatar from './Avatar'

/**
 * Modal to pick an avatar from a curated library (the 48 World Cup team flags).
 * Replaces free uploads — keeps the app safe from inappropriate images.
 *
 * Existing users with free-uploaded avatars stay unchanged until they pick one
 * from the library; nothing is force-migrated.
 */
export default function AvatarPickerModal({ profile, userId, onClose, onUpdated }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedUrl, setSelectedUrl] = useState(profile?.avatar_url || null)

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, flag_url')
      .not('flag_url', 'is', null)
      .order('name')
      .then(({ data }) => {
        if (data) setTeams(data)
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(t => t.name.toLowerCase().includes(q))
  }, [teams, query])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { error: e } = await supabase
        .from('profiles')
        .update({ avatar_url: selectedUrl })
        .eq('id', userId)
      if (e) throw e
      onUpdated?.(selectedUrl)
      onClose?.()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    try {
      const { error: e } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)
      if (e) throw e
      onUpdated?.(null)
      onClose?.()
    } catch (e) {
      setError(e.message || 'Error al quitar')
    } finally {
      setSaving(false)
    }
  }

  const name = profile?.nickname || profile?.full_name

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px',
          width: '100%', maxWidth: '500px',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Elige tu avatar
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '22px', cursor: 'pointer', padding: '0 4px'
          }}>×</button>
        </div>

        {/* Current preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <Avatar
            url={selectedUrl}
            name={name}
            size={48}
            color="rgba(0,144,81,0.18)"
            border="2px solid rgba(0,144,81,0.3)"
            textColor="#4ade80"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Vista previa</div>
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Tu nombre'}
            </div>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar selección…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: '12px',
            borderRadius: '10px', border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            fontSize: '14px', outline: 'none'
          }}
        />

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: '8px', borderRadius: '6px',
            background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)',
            color: '#e74c3c', fontSize: '12px', textAlign: 'center'
          }}>{error}</div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando…</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: '10px'
            }}>
              {filtered.map(t => {
                const isSelected = selectedUrl === t.flag_url
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedUrl(t.flag_url)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '8px 4px',
                      background: isSelected ? 'rgba(0,144,81,0.18)' : 'transparent',
                      border: isSelected ? '2px solid var(--green)' : '2px solid transparent',
                      borderRadius: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <img
                      src={t.flag_url}
                      alt={t.name}
                      style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        objectFit: 'cover', objectPosition: 'center',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    />
                    <span style={{
                      fontSize: '10px', color: isSelected ? 'var(--green)' : 'var(--text-muted)',
                      fontWeight: isSelected ? '700' : '500',
                      textAlign: 'center', lineHeight: '1.2',
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{t.name}</span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
                  Ninguna selección coincide
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {profile?.avatar_url && (
            <button
              onClick={handleRemove}
              disabled={saving}
              style={{
                flex: '0 0 auto', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid rgba(231,76,60,0.3)', background: 'transparent',
                color: '#e74c3c', fontSize: '13px', fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >Quitar</button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || selectedUrl === profile?.avatar_url}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--green)', color: '#fff',
              fontSize: '14px', fontWeight: '700', letterSpacing: '0.3px',
              cursor: (saving || selectedUrl === profile?.avatar_url) ? 'not-allowed' : 'pointer',
              opacity: (saving || selectedUrl === profile?.avatar_url) ? 0.6 : 1
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
