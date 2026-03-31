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
            href="/docs/normas-porra-mundial-2026.docx"
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
            📄 Word
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
            { label: '4. Cuadro real', detail: '31 partidos eliminatorias', pts: 'Exacto +3 / Signo +1 / Fallo 0', phase: 'durante' },
            { label: '5. Órdagos', detail: '6 predicciones opcionales', pts: 'Hasta +9 pero con coste', phase: 'durante' }
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
        <ItemTable items={[
          { label: 'Selección revelación (llega a cuartos)', value: '+2 pts', color: '#4ade80' },
          { label: 'Selección decepción (cae en grupos)', value: '+2 pts', color: '#4ade80' },
          { label: 'Máximo goleador del torneo', value: '+2 pts', color: '#4ade80' },
          { label: 'Máximo asistente del torneo', value: '+2 pts', color: '#4ade80' },
          { label: 'Mejor portero (menos goles encajados)', value: '+2 pts', color: '#4ade80' },
          { label: 'Jugador con 3+ goles en el torneo', value: '+2 pts', color: '#4ade80' },
          { label: 'Selección más goleadora en grupos', value: '+2 pts', color: '#4ade80' },
          { label: 'Selección menos goleada en grupos', value: '+2 pts', color: '#4ade80' },
          { label: '¿Habrá hat-trick en el torneo?', value: '+2 pts', color: '#4ade80' },
          { label: '¿Habrá goleada de 5+ goles?', value: '+2 pts', color: '#4ade80' }
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

      {/* ===== 5. ÓRDAGOS ===== */}
      <Section icon="🔥" title="5. Órdagos" badge="OPCIONALES">
        <div style={{
          margin: '0 0 12px', padding: '10px 12px',
          background: 'rgba(255,204,0,0.08)', border: '1px solid rgba(255,204,0,0.2)',
          borderRadius: '6px', fontSize: '12px', fontWeight: '600',
          color: 'var(--gold)', textAlign: 'center'
        }}>
          ⚠️ Los órdagos son 100% opcionales. Si no participas, ni ganas ni pierdes puntos.
        </div>

        <P>Predicciones especiales a partidos concretos con mayor recompensa, pero con un coste de entrada en puntos.</P>

        <div style={{
          margin: '12px 0', padding: '12px',
          background: 'rgba(255,204,0,0.06)', border: '0.5px solid rgba(255,204,0,0.15)',
          borderRadius: '8px', fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--gold)' }}>¿Cómo funcionan?</strong><br />
          • Se ven todos desde el principio, pero solo puedes predecir en el activo.{'\n'}
          • Cuando se resuelve uno, se desbloquea el siguiente.{'\n'}
          • Puedes participar hasta 3 horas antes del partido.{'\n'}
          • Pagas un coste de entrada en puntos. Si aciertas, ganas más de lo que pagas. Si fallas, pierdes el coste.
        </div>

        <Highlight>
          Ejemplo — Órdago #4 (2º partido de octavos, coste 2 pts):{'\n'}
          Predices 2-1 para el equipo local.{'\n'}
          → Si es exacto: ganas +6, pagas -2 = neto <span style={{color:'#4ade80',fontWeight:600}}>+4</span>{'\n'}
          → Si el local gana por otro marcador: ganas +4, pagas -2 = neto <span style={{color:'#4ade80',fontWeight:600}}>+2</span>{'\n'}
          → Si fallas: ganas 0, pagas -2 = neto <span style={{color:'#e74c3c',fontWeight:600}}>-2</span>
        </Highlight>

        {/* Órdagos table */}
        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 55px 55px 55px',
            padding: '8px 10px', background: 'var(--bg-input)',
            fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600'
          }}>
            <span>#</span>
            <span>Partido</span>
            <span style={{ textAlign: 'center' }}>Coste</span>
            <span style={{ textAlign: 'center' }}>Exacto</span>
            <span style={{ textAlign: 'center' }}>1X2</span>
          </div>
          {[
            { n: 1, match: 'Inglaterra vs Croacia', detail: '17 jun 22:00h — Grupo L', cost: 'GRATIS', exact: '+2', sign: '+1', free: true },
            { n: 2, match: 'Uruguay vs España', detail: '27 jun — Grupo H', cost: '-1', exact: '+3', sign: '+2' },
            { n: 3, match: '1er partido de dieciseisavos', detail: '28 jun 21:00h', cost: '-1', exact: '+3', sign: '+2' },
            { n: 4, match: '2º partido de octavos', detail: '4 jul 23:00h', cost: '-2', exact: '+6', sign: '+4' },
            { n: 5, match: '1er partido de cuartos', detail: '9 jul 22:00h', cost: '-2', exact: '+6', sign: '+4' },
            { n: 6, match: '2ª semifinal', detail: '15 jul 21:00h', cost: '-3', exact: '+9', sign: '+6' }
          ].map((o, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 55px 55px 55px',
              padding: '9px 10px', fontSize: '12px',
              borderTop: '0.5px solid var(--border-light)',
              background: o.free ? 'rgba(0,122,69,0.04)' : 'transparent'
            }}>
              <span style={{ fontWeight: '700', color: 'var(--text-dim)' }}>{o.n}</span>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{o.match}</div>
                {o.detail && <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '1px' }}>{o.detail}</div>}
              </div>
              <span style={{ textAlign: 'center', fontWeight: '600', color: o.free ? '#4ade80' : '#e74c3c' }}>{o.cost}</span>
              <span style={{ textAlign: 'center', fontWeight: '600', color: '#4ade80' }}>{o.exact}</span>
              <span style={{ textAlign: 'center', fontWeight: '600', color: '#4ade80' }}>{o.sign}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '8px', display: 'flex', justifyContent: 'space-between',
          padding: '8px 12px', background: 'var(--bg-input)', borderRadius: '6px',
          fontSize: '11px', color: 'var(--text-muted)'
        }}>
          <span>Si aciertas los 6 exactos: <strong style={{ color: '#4ade80' }}>+20 pts netos</strong></span>
          <span>Si fallas los 6: <strong style={{ color: '#e74c3c' }}>-9 pts</strong></span>
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
          'Los órdagos son 100% opcionales — no participar no penaliza.',
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
