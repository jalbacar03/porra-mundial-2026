import TeamSelector from './TeamSelector'
import PlayerInput from './PlayerInput'
import GroupSelector from './GroupSelector'
import RangeSelector from './RangeSelector'
import YesNoSelector from './YesNoSelector'

const CATEGORY_ICONS = {
  podium: '🏆',
  players: '⚽',
  teams: '🌍',
  stats: '📊',
  yesno: '❓'
}

export default function BetCard({ bet, entry, onSave, disabled }) {
  const isSaved = !!entry
  const isResolved = entry?.is_resolved
  const points = entry?.points_awarded || 0

  function handleChange(newValue) {
    onSave(bet.id, newValue)
  }

  function renderInput() {
    const currentValue = entry?.value || null

    switch (bet.input_type) {
      case 'single_team':
        return (
          <TeamSelector
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
            config={bet.config || {}}
          />
        )

      case 'multi_team':
        return (
          <TeamSelector
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
            config={bet.config || {}}
            multi
          />
        )

      case 'single_player':
        return (
          <PlayerInput
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
            placeholder={
              bet.config?.position === 'goalkeeper'
                ? 'Nombre del portero...'
                : bet.config?.filter === 'opening_match'
                ? 'Jugador del partido inaugural...'
                : 'Nombre del jugador...'
            }
          />
        )

      case 'single_group':
        return (
          <GroupSelector
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
          />
        )

      case 'range':
        return (
          <RangeSelector
            options={bet.config?.options || []}
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
          />
        )

      case 'yes_no':
        return (
          <YesNoSelector
            value={currentValue}
            onChange={handleChange}
            disabled={disabled}
          />
        )

      default:
        return <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Tipo no soportado</div>
    }
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: isResolved
        ? `1px solid ${points > 0 ? 'var(--green)' : 'var(--border)'}`
        : isSaved
        ? '0.5px solid var(--border)'
        : '1px solid rgba(0,122,69,0.3)',
      borderRadius: '10px',
      padding: '16px',
      marginBottom: '10px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Resolved overlay glow */}
      {isResolved && points > 0 && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, var(--green), #00cc66)',
        }} />
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '8px'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '3px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{CATEGORY_ICONS[bet.category] || '📌'}</span>
            <span>{bet.name}</span>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: '1.4'
          }}>
            {bet.description}
          </div>
        </div>

        {/* Points badge */}
        <div style={{
          background: isResolved
            ? points > 0 ? 'var(--green-light)' : 'var(--bg-input)'
            : 'var(--gold-dim)',
          borderRadius: '6px',
          padding: '4px 10px',
          marginLeft: '10px',
          flexShrink: 0,
          textAlign: 'center'
        }}>
          {isResolved ? (
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: points > 0 ? 'var(--green)' : 'var(--text-dim)'
            }}>
              {points > 0 ? `+${points}` : '0'}
            </div>
          ) : (
            <>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: 'var(--gold)',
                lineHeight: '1'
              }}>
                {bet.max_points}
              </div>
              <div style={{
                fontSize: '8px',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                pts máx
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input area */}
      <div style={{ marginTop: '12px' }}>
        {renderInput()}
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        {isResolved ? (
          <span style={{
            padding: '2px 10px',
            borderRadius: '3px',
            fontSize: '10px',
            background: points > 0 ? 'var(--green-light)' : 'var(--bg-input)',
            color: points > 0 ? 'var(--green)' : 'var(--text-dim)',
            fontWeight: '600'
          }}>
            {points > 0 ? '✓ Acertada' : '✗ Fallada'}
          </span>
        ) : isSaved ? (
          <span style={{
            padding: '2px 10px',
            borderRadius: '3px',
            fontSize: '10px',
            background: 'var(--green-light)',
            color: 'var(--green)'
          }}>
            ✓ Guardado
          </span>
        ) : (
          <span style={{
            padding: '2px 10px',
            borderRadius: '3px',
            fontSize: '10px',
            background: 'var(--bg-input)',
            color: 'var(--text-dim)'
          }}>
            Pendiente
          </span>
        )}
      </div>
    </div>
  )
}
