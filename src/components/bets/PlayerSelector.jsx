import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'

const POSITION_BADGES = {
  Goalkeeper: { label: 'POR', color: '#ff8a8a' },
  Defender: { label: 'DEF', color: '#8ac4ff' },
  Midfielder: { label: 'MED', color: '#a8d8a8' },
  Attacker: { label: 'DEL', color: '#ffcc00' }
}

export default function PlayerSelector({ value, onChange, disabled, config = {} }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [hasPlayers, setHasPlayers] = useState(true) // assume yes until proven otherwise
  const debounceRef = useRef(null)

  // Check if players table has data on mount
  useEffect(() => {
    async function checkPlayers() {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
      if (count === 0) setHasPlayers(false)
    }
    checkPlayers()
  }, [])

  function handleSearch(text) {
    setSearch(text)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setShowDropdown(true)
    setSearching(true)

    debounceRef.current = setTimeout(async () => {
      let query = supabase
        .from('players')
        .select('id, name, position, team:teams(name, flag_url)')
        .ilike('name', `%${text}%`)
        .limit(20)

      // Filter by position if config specifies it
      if (config.position === 'goalkeeper') {
        query = query.eq('position', 'Goalkeeper')
      }

      const { data, error } = await query

      if (!error && data) {
        setResults(data)
      }
      setSearching(false)
    }, 300)
  }

  function selectPlayer(player) {
    onChange({
      player_id: player.id,
      player_name: player.name
    })
    setSearch('')
    setResults([])
    setShowDropdown(false)
  }

  function clearSelection() {
    if (disabled) return
    onChange(null)
  }

  const selectedName = value?.player_name
  const selectedId = value?.player_id

  // Fallback to free text if players table is empty
  if (!hasPlayers) {
    return (
      <FreeTextFallback
        value={value}
        onChange={onChange}
        disabled={disabled}
        config={config}
      />
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected player display */}
      {selectedName && !showDropdown ? (
        <button
          onClick={() => !disabled && clearSelection()}
          disabled={disabled}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--green)',
            background: 'var(--green-light)',
            color: 'var(--green)',
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            textAlign: 'left'
          }}
        >
          <span style={{ fontWeight: '600', flex: 1 }}>{selectedName}</span>
          <span style={{ fontSize: '10px', color: 'var(--green)' }}>
            ✓ {disabled ? '' : 'Cambiar'}
          </span>
        </button>
      ) : (
        <input
          type="text"
          placeholder={
            config.position === 'goalkeeper'
              ? 'Buscar portero...'
              : config.filter === 'opening_match'
              ? 'Buscar jugador...'
              : 'Buscar jugador...'
          }
          value={search}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => search.length >= 2 && setShowDropdown(true)}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: showDropdown ? '1px solid var(--green)' : '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            boxSizing: 'border-box',
            opacity: disabled ? 0.5 : 1
          }}
        />
      )}

      {/* Dropdown results */}
      {showDropdown && !disabled && (
        <>
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '0 0 6px 6px',
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            {searching ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center' }}>
                Buscando...
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center' }}>
                {search.length < 2 ? 'Escribe al menos 2 letras' : 'Sin resultados'}
              </div>
            ) : (
              results.map(player => {
                const badge = POSITION_BADGES[player.position]
                return (
                  <button
                    key={player.id}
                    onClick={() => selectPlayer(player)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      border: 'none',
                      background: player.id === selectedId ? 'var(--green-light)' : 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {/* Team flag */}
                    {player.team?.flag_url && (
                      <img src={player.team.flag_url} alt="" style={{
                        width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0
                      }} />
                    )}

                    {/* Player name */}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                    </span>

                    {/* Position badge */}
                    {badge && (
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        background: `${badge.color}20`,
                        color: badge.color,
                        letterSpacing: '0.3px',
                        flexShrink: 0
                      }}>
                        {badge.label}
                      </span>
                    )}

                    {/* Team name */}
                    <span style={{
                      fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0
                    }}>
                      {player.team?.name || ''}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Close on outside click */}
          <div
            onClick={() => { setShowDropdown(false); setSearch('') }}
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
          />
        </>
      )}
    </div>
  )
}

// Fallback: free text input (when players table is empty)
function FreeTextFallback({ value, onChange, disabled, config }) {
  const [text, setText] = useState(value?.player_name || '')

  function handleBlur() {
    const trimmed = text.trim()
    if (trimmed && trimmed !== (value?.player_name || '')) {
      onChange({ player_name: trimmed })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.target.blur()
  }

  const displayValue = value?.player_name || ''
  if (displayValue && !text && displayValue !== text) {
    setText(displayValue)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          config?.position === 'goalkeeper'
            ? 'Nombre del portero...'
            : 'Nombre del jugador...'
        }
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '6px',
          border: text ? '1px solid var(--border)' : '1px solid var(--green)',
          background: 'var(--bg-input)',
          color: text ? 'var(--text-primary)' : 'var(--text-dim)',
          fontSize: '14px',
          boxSizing: 'border-box',
          opacity: disabled ? 0.5 : 1
        }}
      />
      {displayValue && (
        <div style={{
          position: 'absolute', right: '10px', top: '50%',
          transform: 'translateY(-50%)', fontSize: '10px',
          color: 'var(--green)', fontWeight: '600'
        }}>
          ✓
        </div>
      )}
    </div>
  )
}
