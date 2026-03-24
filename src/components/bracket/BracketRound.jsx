import BracketMatchCard from './BracketMatchCard'

/**
 * Renders all matchups for a single round.
 */
export default function BracketRound({ roundKey, label, matches, matchups, picks, points, onPickWinner, disabled, r32Sources }) {
  return (
    <div>
      {/* Round info */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {label}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {matches.length} partidos · {points > 0 ? `${points} pts/acierto` : 'Sin puntos'}
          </span>
        </div>
        {roundKey === 'r32' && (
          <div style={{
            fontSize: '11px', color: '#ffcc00', marginTop: '4px',
            background: 'rgba(255,204,0,0.08)', padding: '6px 10px', borderRadius: '6px'
          }}>
            ⚡ Emparejamientos auto-rellenados según tus predicciones de grupo. Elige el ganador de cada partido.
          </div>
        )}
      </div>

      {/* Match cards */}
      {matches.map(match => {
        const mn = match.matchNumber
        const matchup = matchups[mn] || {}
        const pick = picks[mn]

        // Source labels for R32
        let sourceLabels = null
        if (r32Sources && match.homeSource) {
          sourceLabels = {
            home: getSourceLabel(match.homeSource),
            away: getSourceLabel(match.awaySource)
          }
        }

        return (
          <BracketMatchCard
            key={mn}
            matchNumber={mn}
            home={matchup.home}
            away={matchup.away}
            winnerId={pick?.predicted_winner_id}
            onPickWinner={onPickWinner}
            points={points}
            disabled={disabled}
            sourceLabels={sourceLabels}
          />
        )
      })}
    </div>
  )
}

function getSourceLabel(source) {
  if (source.type === '1st') return `1º Gr.${source.group}`
  if (source.type === '2nd') return `2º Gr.${source.group}`
  if (source.type === '3rd') return `3º`
  return ''
}
