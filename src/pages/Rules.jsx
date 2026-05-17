export default function Rules() {
  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{
              fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)',
              margin: '0 0 4px', letterSpacing: '0.3px'
            }}>
              Normas del torneo
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Todo lo que necesitas saber para participar
            </p>
          </div>
          <a
            href="/docs/normas-porra-mundial-2026.pdf"
            download
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '8px 14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              textDecoration: 'none',
              border: '0.5px solid var(--border)',
              flexShrink: 0
            }}
          >
            📄 PDF
          </a>
        </div>
      </div>

      {/* ===== INTRO ===== */}
      <Section icon="🎯" title="¿Qué es la Porra Mundial 26?">
        <P>Una porra amistosa de predicciones entre amigos para el Mundial 2026. No es una casa de apuestas — es un juego entre amigos sin ánimo de lucro.</P>
        <P>El que más puntos acumule al final del torneo, gana.</P>
      </Section>

      {/* ===== RESUMEN VISUAL (moved up for visibility) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,122,69,0.08), rgba(0,122,69,0.03))',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '14px',
        border: '1px solid rgba(0,122,69,0.15)'
      }}>
        <div style={{
          fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
          marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>📊</span> Resumen rápido — ¿Cómo se puntúa?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { label: '1. Fase de grupos', detail: '72 partidos', pts: 'Exacto +3 / Signo +1 / Fallo 0', phase: 'antes' },
            { label: '2. Cuadro ciego', detail: 'Quién avanza cada ronda', pts: 'Hasta +20 pts (cadena campeón)', phase: 'antes' },
            { label: '3. Especiales', detail: 'Goleador, revelación...', pts: '+2 pts por predicción', phase: 'antes' },
            { label: '4. Cuadro real', detail: '31 partidos eliminatorias', pts: 'Exacto +3 / Signo +1 / Fallo 0', phase: 'durante' }
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '6px'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.label}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>{row.detail}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80' }}>{row.pts}</div>
              </div>
              <span style={{
                fontSize: '8px', padding: '2px 6px', borderRadius: '3px', fontWeight: '600',
                background: row.phase === 'antes' ? 'rgba(255,138,138,0.1)' : 'rgba(255,204,0,0.1)',
                color: row.phase === 'antes' ? '#ff8a8a' : 'var(--gold)',
                textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0
              }}>
                {row.phase}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== PHASE DIVIDER: ANTES ===== */}
      <PhaseDivider label="ANTES DEL MUNDIAL" subtitle="Deadline: 9 de junio de 2026 (48h antes del inicio)" color="#ff8a8a" />

      {/* ===== 1. FASE DE GRUPOS ===== */}
      <Section icon="⚽" title="1. Fase de grupos" badge="72 partidos">
        <P>Predices el resultado exacto (goles de cada equipo) de los 72 partidos de la fase de grupos.</P>
        <Highlight>
          Ejemplo: predices España 2-1 Croacia.{'\n'}
          Si el resultado real es 2-1 → 3 puntos (exacto).{'\n'}
          Si es 1-0 → 1 punto (acertaste que ganaba España).{'\n'}
          Si es 0-0 → 0 puntos (fallaste el signo).
        </Highlight>
        <ItemTable items={[
          { label: 'Resultado exacto', value: '+3 puntos', color: '#4ade80' },
          { label: 'Signo correcto (1X2)', value: '+1 punto', color: '#4ade80' },
          { label: 'Fallo', value: '0 puntos', color: 'var(--text-dim)' }
        ]} />
      </Section>

      {/* ===== 2. CUADRO CIEGO ===== */}
      <Section icon="🏆" title="2. Cuadro ciego" badge="Pre-torneo">
        <P>Antes del Mundial, montas tu cuadro eliminatorio completo: desde dieciseisavos hasta el campeón.</P>
        <P>Los dieciseisavos se auto-rellenan desde tus predicciones de grupo (1º y 2º de cada grupo + 8 mejores terceros). A partir de ahí, eliges quién gana cada eliminatoria.</P>
        <P last>Aquí no predices marcadores, solo quién pasa de ronda.</P>
        <ItemTable items={[
          { label: 'Dieciseisavos (R32)', value: '0 pts (auto)', color: 'var(--text-dim)' },
          { label: 'Octavos de final (×8)', value: '+1 pt por acierto', color: '#4ade80' },
          { label: 'Cuartos de final (×4)', value: '+2 pts por acierto', color: '#4ade80' },
          { label: 'Semifinales (×2)', value: '+4 pts por acierto', color: '#4ade80' },
          { label: 'Final (×1)', value: '+5 pts por acierto', color: '#4ade80' },
          { label: 'Campeón', value: '+8 pts', color: '#4ade80' }
        ]} />
        <Highlight>
          Si aciertas toda la cadena de tu campeón (desde octavos hasta ganar la final), sumas hasta 20 puntos.
        </Highlight>
      </Section>

      {/* ===== 3. PREDICCIONES ESPECIALES ===== */}
      <Section icon="🎲" title="3. Predicciones especiales" badge="Pre-torneo">
        <P last>Predicciones extra sobre el torneo. Se rellenan antes del inicio del Mundial.</P>

        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 6px' }}>
          Jugadores
        </div>
        <ItemTable items={[
          { label: 'MVP del torneo', value: '+5 pts', color: '#4ade80' },
          { label: 'Bota de Oro (máximo goleador)', value: '+3 pts', color: '#4ade80' },
          { label: 'Máximo asistente', value: '+3 pts', color: '#4ade80' },
          { label: 'Guante de Oro (mejor portero)', value: '+3 pts', color: '#4ade80' }
        ]} />

        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>
          Selecciones
        </div>
        <ItemTable items={[
          { label: 'Selección revelación (llega a cuartos)', value: '+3 pts', color: '#4ade80' },
          { label: 'Selección decepción (cae en grupos)', value: '+3 pts', color: '#4ade80' },
          { label: 'Selección más goleadora en grupos', value: '+2 pts', color: '#4ade80' },
          { label: 'Selección menos goleada en grupos', value: '+2 pts', color: '#4ade80' }
        ]} />

        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '14px 0 6px' }}>
          ¿Sí o No?
        </div>
        <ItemTable items={[
          { label: '¿Habrá hat-trick en el torneo?', value: '+1 pt', color: '#4ade80' },
          { label: '¿Goleada por 5+ goles de diferencia?', value: '+1 pt', color: '#4ade80' },
          { label: '¿La final se decidirá en penaltis?', value: '+1 pt', color: '#4ade80' },
          { label: '¿El país campeón será europeo?', value: '+1 pt', color: '#4ade80' },
          { label: '¿Ambos equipos verán roja en un mismo partido?', value: '+1 pt', color: '#4ade80' }
        ]} />
      </Section>

      {/* ===== PHASE DIVIDER: DURANTE ===== */}
      <PhaseDivider label="DURANTE EL MUNDIAL" subtitle="Nuevas oportunidades de sumar (y perder) puntos" color="#ffcc00" />

      {/* ===== 4. CUADRO REAL ===== */}
      <Section icon="⚡" title="4. Cuadro real" badge="31 partidos">
        <P>Cuando termine la fase de grupos y se conozca el cuadro real, se abre una nueva ronda de predicciones.</P>
        <P>Ahora predices el resultado exacto a 90 minutos de cada partido eliminatorio (igual que en grupos).</P>
        <Highlight>
          Importante: predices el resultado a los 90 minutos, no quién pasa de ronda.{'\n'}
          Puedes predecir un empate (ej: 1-1) aunque sea eliminatoria — el partido se resuelve en prórroga/penaltis, pero tú predices el marcador de los 90'.
        </Highlight>
        <ItemTable items={[
          { label: 'Resultado exacto', value: '+3 puntos', color: '#4ade80' },
          { label: 'Signo correcto (1X2)', value: '+1 punto', color: '#4ade80' },
          { label: 'Fallo', value: '0 puntos', color: 'var(--text-dim)' }
        ]} />
        <P style={{ marginTop: '10px' }}>El deadline es antes de que empiece cada ronda (ej: debes predecir los octavos antes de que se juegue el primer octavo).</P>

        <div style={{
          marginTop: '10px', padding: '10px 12px',
          background: 'rgba(0,122,69,0.06)', border: '0.5px solid rgba(0,122,69,0.15)',
          borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>¿Se solapan cuadro ciego y cuadro real?</strong><br />
          No. Son predicciones distintas y sumas ambas. En el cuadro ciego predices quién avanza; en el cuadro real predices el marcador. Puedes acertar uno y fallar el otro.
        </div>
      </Section>

      {/* ===== CLASIFICACIÓN ===== */}
      <Section icon="🏅" title="Clasificación y desempate">
        <P>La clasificación se actualiza automáticamente conforme se juegan los partidos.</P>
        <P>En caso de empate a puntos en la clasificación general, desempatará el mayor número de resultados exactos conseguidos en la fase de grupos.</P>
        <P last>La clasificación de los "últimos 3 días" es solo informativa — no cuenta para la puntuación final.</P>
        <div style={{
          marginTop: '10px', padding: '10px 12px',
          background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--border)',
          borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Referencia: Casas de apuestas</strong><br />
          En la clasificación verás una línea de referencia basada en las predicciones de las casas de apuestas. Si estás por encima, vas mejor que las estadísticas.
        </div>
      </Section>

      {/* ===== FECHAS CLAVE ===== */}
      <Section icon="📅" title="Fechas clave">
        <ItemTable items={[
          { label: 'Deadline predicciones pre-torneo', value: '9 de junio de 2026', color: '#ff8a8a' },
          { label: 'Inicio del Mundial', value: '11 de junio de 2026', color: 'var(--text-primary)' },
          { label: 'Final del Mundial', value: '19 de julio de 2026', color: '#4ade80' }
        ]} />
      </Section>

      {/* ===== REGLAS GENERALES ===== */}
      <Section icon="🔒" title="Reglas generales">
        <BulletList items={[
          'No se pueden modificar predicciones una vez cerrado el plazo.',
          'Las predicciones de otros participantes no son visibles hasta que cierre el plazo.',
          'La inscripción debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.',
          'En el registro debes indicar tu nombre y apellido reales. Si no se puede identificar al usuario de forma inequívoca, no recibirá premio en caso de ganar (el nickname es opcional, sólo para mostrar).',
          'El organizador se reserva el derecho de resolver disputas.'
        ]} />
      </Section>

      <div style={{ height: '100px' }} />
    </div>
  )
}

/* ===== REUSABLE COMPONENTS ===== */

function Section({ icon, title, badge, children }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '10px',
      border: '0.5px solid var(--border)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'
      }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', flex: 1 }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: '9px', padding: '3px 8px', borderRadius: '4px',
            background: badge === 'OPCIONALES' ? 'rgba(255,204,0,0.1)' : 'var(--bg-input)',
            color: badge === 'OPCIONALES' ? 'var(--gold)' : 'var(--text-dim)',
            fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px'
          }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function PhaseDivider({ label, subtitle, color }) {
  return (
    <div style={{
      margin: '20px 0 14px',
      padding: '14px 16px',
      borderRadius: '8px',
      background: `linear-gradient(135deg, ${color}10, ${color}05)`,
      border: `1px solid ${color}25`,
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '12px', fontWeight: '700', color,
        letterSpacing: '1.5px', textTransform: 'uppercase'
      }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function P({ children, last, style }) {
  return (
    <p style={{
      fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6',
      margin: last ? '0' : '0 0 8px',
      ...style
    }}>
      {children}
    </p>
  )
}

function Highlight({ children }) {
  return (
    <div style={{
      margin: '10px 0',
      padding: '10px 12px',
      background: 'rgba(255,204,0,0.05)',
      border: '0.5px solid rgba(255,204,0,0.12)',
      borderRadius: '6px',
      fontSize: '12px',
      color: 'var(--text-muted)',
      lineHeight: '1.7',
      whiteSpace: 'pre-line'
    }}>
      {children}
    </div>
  )
}

function ItemTable({ items }) {
  return (
    <div style={{
      marginTop: '8px',
      display: 'flex', flexDirection: 'column', gap: '4px'
    }}>
      {items.map((item, j) => (
        <div key={j} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: '6px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {item.label}
          </span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: item.color || 'var(--text-primary)' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function BulletList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5'
        }}>
          <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: '2px' }}>•</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}
