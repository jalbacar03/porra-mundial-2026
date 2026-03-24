/**
 * Single matchup card in the bracket.
 * Shows two teams — user taps one to pick as winner.
 */
export default function BracketMatchCard({ matchNumber, home, away, winnerId, onPickWinner, points, disabled, sourceLabels }) {
  const hasTeams = home && away

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '8px',
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Match info header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
          Partido {matchNumber}
        </span>
        {points > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: '600', color: '#ffcc00',
            background: 'rgba(255,204,0,0.1)', padding: '2px 6px', borderRadius: '4px'
          }}>
            +{points} pts
          </span>
        )}
        {points === 0 && (
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            auto
          </span>
        )}
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Home team */}
        <TeamButton
          team={home}
          isSelected={hasTeams && winnerId === home?.id}
          onClick={() => hasTeams && !disabled && onPickWinner(matchNumber, home.id)}
          disabled={disabled || !hasTeams}
          sourceLabel={sourceLabels?.home}
        />

        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600', flexShrink: 0 }}>
          vs
        </span>

        {/* Away team */}
        <TeamButton
          team={away}
          isSelected={hasTeams && winnerId === away?.id}
          onClick={() => hasTeams && !disabled && onPickWinner(matchNumber, away.id)}
          disabled={disabled || !hasTeams}
          sourceLabel={sourceLabels?.away}
        />
      </div>
    </div>
  )
}

function TeamButton({ team, isSelected, onClick, disabled, sourceLabel }) {
  if (!team) {
    return (
      <div style={{
        flex: 1, padding: '10px', borderRadius: '6px',
        background: 'var(--bg-primary)', textAlign: 'center',
        border: '1px dashed rgba(255,255,255,0.1)'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '2px' }}>❓</div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
          {sourceLabel || 'Por determinar'}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '10px', borderRadius: '6px',
        background: isSelected ? 'rgba(0,122,69,0.2)' : 'var(--bg-primary)',
        border: isSelected ? '2px solid var(--green)' : '2px solid transparent',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s'
      }}
    >
      {team.flag_url && (
        <img
          src={team.flag_url}
          alt=""
          style={{ width: '24px', height: '16px', borderRadius: '2px', marginBottom: '4px', display: 'block', margin: '0 auto 4px' }}
        />
      )}
      <div style={{
        fontSize: '12px', fontWeight: isSelected ? '700' : '500',
        color: isSelected ? 'var(--green)' : 'var(--text-primary)'
      }}>
        {team.name}
      </div>
      {isSelected && (
        <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '2px' }}>
          ✓ Ganador
        </div>
      )}
    </button>
  )
}
