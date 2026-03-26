export default function Rules() {
  const sections = [
    {
      icon: '🎯',
      title: '¿Qué es la Porra Mundial 26?',
      content: [
        'Una porra amistosa de predicciones entre amigos para el Mundial de Fútbol 2026. Se trata de un juego entre amigos sin ánimo de lucro — no es una casa de apuestas.',
        'Cada participante compite por acertar los resultados de los partidos, el cuadro eliminatorio y otras apuestas especiales.',
        'El que más puntos acumule al final del torneo, gana.'
      ]
    },
    {
      icon: '⚽',
      title: 'Predicciones de partidos (fase de grupos)',
      content: [
        'Debes predecir el resultado exacto (goles de cada equipo) de los 48 partidos de la fase de grupos.',
        'Las predicciones deben realizarse antes de la fecha límite: 48 horas antes del inicio del Mundial.'
      ],
      items: [
        { label: 'Resultado exacto', value: '3 puntos' },
        { label: 'Signo correcto (1X2)', value: '1 punto' },
        { label: 'Fallo total', value: '0 puntos' }
      ]
    },
    {
      icon: '🏆',
      title: 'Cuadro eliminatorio',
      content: [
        'Predice el ganador de cada partido del cuadro eliminatorio, desde dieciseisavos hasta la final.',
        'Los dieciseisavos se auto-rellenan desde tus predicciones de grupo (top 2 + 8 mejores terceros).',
        'Si aciertas toda la cadena del campeón, sumas hasta 20 puntos extra.'
      ],
      items: [
        { label: 'Dieciseisavos (R32)', value: '0 pts (auto-rellenado)' },
        { label: 'Octavos de final', value: '1 pt por acierto (máx 16)' },
        { label: 'Cuartos de final', value: '2 pts por acierto (máx 16)' },
        { label: 'Semifinales', value: '4 pts por acierto (máx 16)' },
        { label: 'Final', value: '5 pts por acierto (máx 10)' },
        { label: 'Campeón', value: '8 pts' }
      ]
    },
    {
      icon: '🎲',
      title: 'Apuestas especiales (pre-torneo)',
      content: [
        'Además de los partidos, hay apuestas especiales que debes completar antes del inicio del Mundial.',
        'Cubren temas como: máximo goleador, selección revelación, selección decepción, y más.'
      ],
      items: [
        { label: 'Revelación (llega a cuartos)', value: '4 puntos' },
        { label: 'Decepción (cae en grupos)', value: '4 puntos' },
        { label: 'Goleador, asistencias, portero...', value: 'Según categoría' },
        { label: 'Más goleadora / Menos goleada', value: '3 puntos' },
        { label: '¿Habrá hat-trick? ¿Goleada 5+?', value: 'Sí / No' }
      ]
    },
    {
      icon: '📅',
      title: 'Fechas clave',
      items: [
        { label: 'Deadline predicciones', value: '9 de junio de 2026' },
        { label: 'Inicio del Mundial', value: '11 de junio de 2026' },
        { label: 'Final del Mundial', value: '19 de julio de 2026' }
      ]
    },
    {
      icon: '📊',
      title: 'Clasificación',
      content: [
        'La clasificación se actualiza automáticamente conforme se juegan los partidos.',
        'En caso de empate a puntos, gana quien tenga más resultados exactos.',
        'La clasificación de los "últimos 3 días" es solo informativa — no cuenta para la puntuación final.'
      ]
    },
    {
      icon: '🤖',
      title: 'Bot365',
      content: [
        'Bot365 es un participante ficticio cuyas predicciones se basan en las cuotas de las casas de apuestas.',
        'Sirve como referencia — si le superas, vas mejor que lo que dicen las estadísticas.',
        'No compite por la clasificación, solo está ahí para comparar.'
      ]
    },
    {
      icon: '🔒',
      title: 'Reglas importantes',
      content: [
        'No se pueden modificar predicciones una vez cerrado el plazo.',
        'Las apuestas de otros participantes no son visibles hasta que cierre el plazo.',
        'La inscripción debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.',
        'El organizador se reserva el derecho de resolver disputas.'
      ]
    }
  ]

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{
          fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
          margin: '0 0 4px', letterSpacing: '0.3px'
        }}>
          Normas del torneo
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          Todo lo que necesitas saber
        </p>
      </div>

      {sections.map((section, i) => (
        <div key={i} style={{
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '10px',
          border: '0.5px solid var(--border)'
        }}>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'
          }}>
            <span style={{ fontSize: '18px' }}>{section.icon}</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {section.title}
            </span>
          </div>

          {/* Paragraphs */}
          {section.content && section.content.map((text, j) => (
            <p key={j} style={{
              fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6',
              margin: j < section.content.length - 1 ? '0 0 8px' : '0'
            }}>
              {text}
            </p>
          ))}

          {/* Key-value items */}
          {section.items && (
            <div style={{
              marginTop: section.content ? '12px' : '0',
              display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              {section.items.map((item, j) => (
                <div key={j} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'var(--bg-input)', borderRadius: '6px'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
