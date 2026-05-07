import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import Avatar from './Avatar'
import { SYMBOL_AVATARS } from './avatarLibrary'

/**
 * Avatar picker — choose from 48 World Cup team flags or 12 soccer symbols.
 *
 * Modes:
 *  - mandatory=true: shown when user has no avatar yet (initial pick during
 *    onboarding). No close button, no quit option, must pick to dismiss.
 *  - mandatory=false: regular change. Limited to ONE change after the
 *    initial pick — once profile.avatar_changes_count >= 1 the picker is
 *    read-only.
 */
export default function AvatarPickerModal({ profile, userId, onClose, onUpdated, mandatory = false }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('teams') // 'teams' | 'symbols'
  const [query, setQuery] = useState('')
  const [selectedUrl, setSelectedUrl] = useState(profile?.avatar_url || null)

  const isInitialPick = !profile?.avatar_url
  const changesUsed = profile?.avatar_changes_count || 0
  const locked = !isInitialPick && changesUsed >= 1

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

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(t => t.name.toLowerCase().includes(q))
  }, [teams, query])

  const filteredSymbols = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SYMBOL_AVATARS
    return SYMBOL_AVATARS.filter(s => s.name.toLowerCase().includes(q))
  }, [query])

  async function handleSave() {
    if (locked) return
    setSaving(true)
    setError(null)
    try {
      const update = { avatar_url: selectedUrl }
      // If this is a CHANGE (not the initial pick), bump the counter.
      if (!isInitialPick) update.avatar_changes_count = changesUsed + 1
      const { error: e } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', userId)
      if (e) throw e
      onUpdated?.(selectedUrl, update.avatar_changes_count ?? changesUsed)
      onClose?.()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const name = profile?.nickname || profile?.full_name
  const canDismiss = !mandatory
  const canSave = !locked && selectedUrl && selectedUrl !== profile?.avatar_url

  return (
    <div
      onClick={canDismiss ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 0
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 16px',
          width: '100%', maxWidth: '500px',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {mandatory ? 'Elige tu avatar' : locked ? 'Tu avatar' : 'Cambiar avatar'}
          </h3>
          {canDismiss && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '22px', cursor: 'pointer', padding: '0 4px'
            }}>×</button>
          )}
        </div>

        {/* Status note */}
        <p style={{
          fontSize: '11px', color: locked ? '#e24b4a' : 'var(--text-dim)',
          margin: '0 0 12px', lineHeight: '1.4'
        }}>
          {locked
            ? '🔒 Ya usaste tu único cambio. El avatar queda fijo a partir de ahora.'
            : isInitialPick
              ? 'Tu avatar inicial. Después solo podrás cambiarlo una vez más.'
              : 'Tienes un cambio disponible. Después quedará fijo.'}
        </p>

        {/* Current preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Avatar
            url={selectedUrl}
            name={name}
            size={48}
            color="rgba(0,144,81,0.18)"
            border="2px solid rgba(0,144,81,0.3)"
            textColor="#4ade80"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Vista previa</div>
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Tu nombre'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '3px',
          background: 'var(--bg-input)', borderRadius: '8px', marginBottom: '10px'
        }}>
          {[
            { key: 'teams', label: `Selecciones (${teams.length})` },
            { key: 'symbols', label: `Símbolos (${SYMBOL_AVATARS.length})` }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: '6px', border: 'none',
                background: tab === t.key ? 'var(--bg-secondary)' : 'transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '12px', fontWeight: tab === t.key ? '700' : '500',
                cursor: 'pointer'
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={tab === 'teams' ? 'Buscar selección…' : 'Buscar símbolo…'}
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
          {loading && tab === 'teams' ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Cargando…</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: '10px'
            }}>
              {(tab === 'teams' ? filteredTeams : filteredSymbols).map(item => {
                const url = item.flag_url || item.url
                const label = item.name
                const isSel = selectedUrl === url
                return (
                  <button
                    key={item.id}
                    onClick={() => !locked && setSelectedUrl(url)}
                    disabled={locked}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '8px 4px',
                      background: isSel ? 'rgba(0,144,81,0.18)' : 'transparent',
                      border: isSel ? '2px solid var(--green)' : '2px solid transparent',
                      borderRadius: '10px',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked && !isSel ? 0.5 : 1
                    }}
                  >
                    <img
                      src={url}
                      alt={label}
                      style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        objectFit: 'cover', objectPosition: 'center',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'var(--bg-input)'
                      }}
                    />
                    <span style={{
                      fontSize: '10px', color: isSel ? 'var(--green)' : 'var(--text-muted)',
                      fontWeight: isSel ? '700' : '500',
                      textAlign: 'center', lineHeight: '1.2',
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>{label}</span>
                  </button>
                )
              })}
              {(tab === 'teams' ? filteredTeams : filteredSymbols).length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
                  Nada coincide
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save */}
        {!locked && (
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            style={{
              marginTop: '14px', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--green)', color: '#fff',
              fontSize: '14px', fontWeight: '700', letterSpacing: '0.3px',
              cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
              opacity: (saving || !canSave) ? 0.6 : 1
            }}
          >
            {saving ? 'Guardando…' : isInitialPick ? 'Confirmar avatar' : 'Usar mi cambio'}
          </button>
        )}
      </div>
    </div>
  )
}
