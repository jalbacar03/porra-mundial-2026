import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

export default function TeamSelector({ value, onChange, disabled, config = {}, multi = false }) {
  const [teams, setTeams] = useState([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code, flag_url')
      .order('name')
    if (data) {
      let filtered = data
      // Exclude teams (for "Revelación")
      if (config.excluded_teams?.length) {
        filtered = filtered.filter(t => !config.excluded_teams.includes(t.name))
      }
      // Only specific teams (for "Decepción")
      if (config.only_teams?.length) {
        filtered = filtered.filter(t => config.only_teams.includes(t.name))
      }
      setTeams(filtered)
    }
  }

  // Multi-team selection
  if (multi) {
    const selectedIds = value?.teams || []
    const exactCount = config.exact_count || null
    const isAtLimit = exactCount && selectedIds.length >= exactCount

    function toggleTeam(teamId) {
      if (disabled) return
      let newIds
      if (selectedIds.includes(teamId)) {
        newIds = selectedIds.filter(id => id !== teamId)
      } else {
        if (isAtLimit) return
        newIds = [...selectedIds, teamId]
      }
      onChange({ teams: newIds })
    }

    const filteredTeams = search
      ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
      : teams

    return (
      <div>
        {/* Counter */}
        {exactCount && (
          <div style={{
            fontSize: '11px',
            color: selectedIds.length === exactCount ? 'var(--green)' : 'var(--gold)',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'right'
          }}>
            {selectedIds.length}/{exactCount} seleccionadas
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar selección..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            boxSizing: 'border-box',
            marginBottom: '8px',
            opacity: disabled ? 0.5 : 1
          }}
        />

        {/* Team grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '4px',
          maxHeight: '240px',
          overflowY: 'auto',
          padding: '2px'
        }}>
          {filteredTeams.map(team => {
            const isSelected = selectedIds.includes(team.id)
            return (
              <button
                key={team.id}
                onClick={() => toggleTeam(team.id)}
                disabled={disabled || (!isSelected && isAtLimit)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: isSelected ? '1.5px solid var(--green)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--green-light)' : 'var(--bg-input)',
                  color: isSelected ? 'var(--green)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: disabled || (!isSelected && isAtLimit) ? 'not-allowed' : 'pointer',
                  opacity: disabled || (!isSelected && isAtLimit) ? 0.4 : 1,
                  textAlign: 'left'
                }}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" style={{
                    width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover', flexShrink: 0
                  }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {team.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Single team selection
  const selectedTeam = teams.find(t => t.id === value?.team_id)

  function selectTeam(team) {
    onChange({ team_id: team.id })
    setSearch('')
    setShowDropdown(false)
  }

  const filteredTeams = search
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected display or search input */}
      {selectedTeam && !showDropdown ? (
        <button
          onClick={() => !disabled && setShowDropdown(true)}
          disabled={disabled}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1
          }}
        >
          {selectedTeam.flag_url && (
            <img src={selectedTeam.flag_url} alt="" style={{
              width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover'
            }} />
          )}
          <span style={{ fontWeight: '500' }}>{selectedTeam.name}</span>
          <span style={{
            marginLeft: 'auto', fontSize: '10px', color: 'var(--green)', fontWeight: '600'
          }}>✓ Cambiar</span>
        </button>
      ) : (
        <input
          type="text"
          placeholder="Buscar selección..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          disabled={disabled}
          autoFocus={showDropdown}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--green)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            boxSizing: 'border-box',
            opacity: disabled ? 0.5 : 1
          }}
        />
      )}

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '200px',
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '0 0 6px 6px',
          zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          {filteredTeams.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center' }}>
              Sin resultados
            </div>
          ) : (
            filteredTeams.map(team => (
              <button
                key={team.id}
                onClick={() => selectTeam(team)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  border: 'none',
                  background: team.id === value?.team_id ? 'var(--green-light)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" style={{
                    width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover'
                  }} />
                )}
                {team.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {showDropdown && (
        <div
          onClick={() => { setShowDropdown(false); setSearch('') }}
          style={{
            position: 'fixed', inset: 0, zIndex: 49
          }}
        />
      )}
    </div>
  )
}
