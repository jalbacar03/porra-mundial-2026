import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

export default function TeamSelector({ value, onChange, disabled, config = {}, multi = false }) {
  const [teams, setTeams] = useState([])
  const [search, setSearch] = useState('')

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
      if (config.excluded_teams?.length) {
        filtered = filtered.filter(t => !config.excluded_teams.includes(t.name))
      }
      if (config.only_teams?.length) {
        filtered = filtered.filter(t => config.only_teams.includes(t.name))
      }
      setTeams(filtered)
    }
  }

  const filteredTeams = search
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams

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

    return (
      <div>
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

  // Single team selection — GRID style (same as multi but select one)
  const selectedTeamId = value?.team_id
  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  function selectTeam(team) {
    if (disabled) return
    onChange({ team_id: team.id })
  }

  return (
    <div>
      {/* Show selected team badge */}
      {selectedTeam && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', marginBottom: '8px',
          background: 'var(--green-light)', borderRadius: '6px',
          border: '1px solid var(--green)'
        }}>
          {selectedTeam.flag_url && (
            <img src={selectedTeam.flag_url} alt="" style={{
              width: '20px', height: '14px', borderRadius: '2px', objectFit: 'cover'
            }} />
          )}
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)', flex: 1 }}>
            {selectedTeam.name}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--green)' }}>✓</span>
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
          const isSelected = team.id === selectedTeamId
          return (
            <button
              key={team.id}
              onClick={() => selectTeam(team)}
              disabled={disabled}
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
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
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
