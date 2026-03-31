import { useState } from 'react'
import { supabase } from '../supabase'

const RULES_SECTIONS = [
  {
    icon: '🎯',
    title: '¿Qué es la Porra Mundial 26?',
    content: [
      'Una porra amistosa de predicciones entre amigos para el Mundial de Fútbol 2026. Se trata de un juego entre amigos sin ánimo de lucro — no es una casa de apuestas.',
      'Cada participante compite por acertar los resultados de los partidos, el cuadro eliminatorio y otras predicciones especiales.',
      'El que más puntos acumule al final del torneo, gana.'
    ]
  },
  {
    icon: '⚽',
    title: 'Predicciones de partidos',
    items: [
      { label: 'Resultado exacto', value: '3 puntos' },
      { label: 'Signo correcto (1X2)', value: '1 punto' },
      { label: 'Fallo total', value: '0 puntos' }
    ]
  },
  {
    icon: '🏆',
    title: 'Cuadro eliminatorio',
    items: [
      { label: 'Octavos', value: '1 pt/acierto' },
      { label: 'Cuartos', value: '2 pts/acierto' },
      { label: 'Semifinales', value: '4 pts/acierto' },
      { label: 'Final', value: '5 pts/acierto' },
      { label: 'Campeón', value: '8 pts' }
    ]
  },
  {
    icon: '🎲',
    title: 'Predicciones especiales',
    items: [
      { label: 'Revelación (llega a cuartos)', value: '4 pts' },
      { label: 'Decepción (cae en grupos)', value: '4 pts' },
      { label: 'Goleador, asistencias...', value: 'Según categoría' }
    ]
  },
  {
    icon: '🔒',
    title: 'Reglas importantes',
    content: [
      'No se pueden modificar predicciones una vez cerrado el plazo.',
      'Las predicciones de otros no son visibles hasta que cierre el plazo.',
      'La inscripción debe estar confirmada antes del inicio del Mundial.'
    ]
  }
]

export default function RulesPopup({ userId, onAccepted }) {
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ rules_accepted: true })
      .eq('id', userId)

    if (!error) {
      onAccepted()
    } else {
      console.error('Error accepting rules:', error)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--bg-primary, #1a1d26)',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'auto',
        padding: '24px 20px',
        border: '1px solid var(--border, #2a2d37)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          <h2 style={{
            fontSize: '18px', fontWeight: '700',
            color: 'var(--text-primary, #fff)',
            margin: '0 0 6px'
          }}>
            Normas del torneo
          </h2>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-dim, #666)',
            margin: 0
          }}>
            Lee y acepta las normas para continuar
          </p>
        </div>

        {/* Highlight box */}
        <div style={{
          background: 'rgba(255,204,0,0.1)',
          border: '1px solid rgba(255,204,0,0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <span style={{
            fontSize: '13px',
            color: 'var(--gold, #ffcc00)',
            fontWeight: '600',
            lineHeight: '1.5'
          }}>
            Esta es una porra amistosa entre amigos. No es una casa de apuestas ni tiene ánimo de lucro.
          </span>
        </div>

        {/* Rules sections */}
        {RULES_SECTIONS.map((section, i) => (
          <div key={i} style={{
            background: 'var(--bg-secondary, #22252f)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '8px',
            border: '0.5px solid var(--border, #2a2d37)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>{section.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary, #fff)' }}>
                {section.title}
              </span>
            </div>

            {section.content && section.content.map((text, j) => (
              <p key={j} style={{
                fontSize: '12px', color: 'var(--text-secondary, #aaa)',
                lineHeight: '1.5', margin: j < section.content.length - 1 ? '0 0 6px' : '0'
              }}>
                {text}
              </p>
            ))}

            {section.items && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: section.content ? '8px' : '0' }}>
                {section.items.map((item, j) => (
                  <div key={j} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', background: 'var(--bg-input, #2a2d37)', borderRadius: '4px'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>{item.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary, #fff)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Accept button */}
        <button
          onClick={handleAccept}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            marginTop: '16px',
            background: 'var(--green, #007a45)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Guardando...' : 'Aceptar normas'}
        </button>
      </div>
    </div>
  )
}
