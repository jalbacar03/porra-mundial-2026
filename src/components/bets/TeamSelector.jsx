import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'

const SOURCE_LABELS = {
  champion: 'Campeón',
  finalists: 'Finalista',
  semi_finalists: 'Semi',
  quarter_finalists: 'Cuartos',
  round_of_16: 'Octavos'
}

const SOURCE_COLORS = {
  champion: { bg: 'rgba(255,204,0,0.15)', border: 'var(--gold)', text: 'var(--gold)' },
  finalists: { bg: 'rgba(255,204,0,0.10)', border: 'rgba(255,204,0,0.5)', text: 'var(--gold)' },
  semi_finalists: { bg: 'rgba(0,122,69,0.10)', border: 'var(--green)', text: 'var(--green)' },
  quarter_finalists: { bg: 'rgba(0,122,69,0.08)', border: 'rgba(0,122,69,0.4)', text: 'var(--green)' },
  round_of_16: { bg: 'rgba(0,122,69,0.05)', border: 'rgba(0,122,69,0.3)', text: 'var(--green)' }
}

export default function TeamSelector({ value, onChange, disabled, config = {}, multi = false, lockedTeams = [] }) {
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

  const lockedIds = lockedTeams.map(lt => lt.teamId)

  const filteredTeams = search
    ? teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams

  // Multi-team selection
  if (multi) {
    const allSelectedIds = value?.teams || []
    const manualIds = allSelectedIds.filter(id => !lockedIds.includes(id))
    const exactCount = config.exact_count || null
    const manualSlots = exactCount ? exactCount - lockedIds.length : null
    const isAtLimit = manualSlots !== null && manualIds.length >= manualSlots

    function toggleTeam(teamId) {
      if (disabled) return
      if (lockedIds.includes(teamId)) return // can't toggle locked

      let newManualIds
      if (manualIds.includes(teamId)) {
        newManualIds = manualIds.filter(id => id !== teamId)
      } else {
        if (isAtLimit) return
        newManualIds = [...manualIds, teamId]
      }
      // Always include locked + manual
      onChange({ teams: [...lockedIds, ...newManualIds] })
    }

    // Split into locked teams (pinned top) and rest
    const lockedTeamObjects = lockedTeams
      .map(lt => {
        const team = teams.find(t => t.id === lt.teamId)
        return team ? { ...team, source: lt.source } : null
      })
      .filter(Boolean)

    const nonLockedFiltered = filteredTeams.filter(t => !lockedIds.includes(t.id))

    return (
      <div>
        {/* Counter */}
        {exactCount && (
          <div style={{
            fontSize: '11px',
            color: (manualIds.length + lockedIds.length) === exactCount ? 'var(--green)' : 'var(--gold)',
            fontWeight: '600',
            marginBottom: '8px',
            textAlign: 'right'
          }}>
            {manualIds.length + lockedIds.length}/{exactCount} seleccionadas
            {lockedIds.length > 0 && (
              <span style={{ color: 'var(--text-dim)', fontWeight: '400' }}>
                {' '}({lockedIds.length} auto)
              </span>
            )}
          </div>
        )}

        {/* Locked teams pinned at top */}
        {lockedTeamObjects.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px'
          }}>
            {lockedTeamObjects.map(team => {
              const colors = SOURCE_COLORS[team.source] || SOURCE_COLORS.round_of_16
              return (
                <div
                  key={team.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    border: `1.5px solid ${colors.border}`,
                    background: colors.bg,
                    fontSize: '11px',
                    fontWeight: '600',
                    color: colors.text
                  }}
                >
                  {team.flag_url && (
                    <img src={team.flag_url} alt="" style={{
                      width: '16px', height: '11px', borderRadius: '1px', objectFit: 'cover'
                    }} />
                  )}
                  <span>{team.name}</span>
                  <span style={{
                    fontSize: '8px', padding: '1px 4px', borderRadius: '2px',
                    background: 'rgba(0,0,0,0.2)', color: colors.text,
                    textTransform: 'uppercase', letterSpacing: '0.3px'
                  }}>
                    {SOURCE_LABELS[team.source] || 'Auto'}
                  </span>
                </div>
              )
            })}
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

        {/* Team grid (non-locked only) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '4px',
          maxHeight: '240px',
          overflowY: 'auto',
          padding: '2px'
        }}>
          {nonLockedFiltered.map(team => {
            const isSelected = manualIds.includes(team.id)
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

  // Single team selection — grid style
  const selectedTeamId = value?.team_id
  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  function selectTeam(team) {
    if (disabled) return
    onChange({ team_id: team.id })
  }

  return (
    <div>
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
