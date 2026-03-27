export default function Rules() {
  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px', minHeight: '100svh' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
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

      {/* ===== INTRO ===== */}
      <Section icon="🎯" title="¿Qué es la Porra Mundial 26?">
        <P>Una porra amistosa de predicciones entre amigos para el Mundial 2026. No es una casa de apuestas — es un juego entre amigos sin ánimo de lucro.</P>
        <P>El que más puntos acumule al final del torneo, gana.</P>
      </Section>

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
          { label: 'Resultado exacto', value: '3 puntos', color: '#4ade80' },
          { label: 'Signo correcto (1X2)', value: '1 punto', color: 'var(--gold)' },
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
          { label: 'Octavos de final (×8)', value: '1 pt por acierto', color: 'var(--text-secondary)' },
          { label: 'Cuartos de final (×4)', value: '2 pts por acierto', color: 'var(--text-secondary)' },
          { label: 'Semifinales (×2)', value: '4 pts por acierto', color: 'var(--gold)' },
          { label: 'Final (×1)', value: '5 pts por acierto', color: 'var(--gold)' },
          { label: 'Campeón', value: '8 pts', color: '#4ade80' }
        ]} />
        <Highlight>
          Si aciertas toda la cadena de tu campeón (desde octavos hasta ganar la final), sumas hasta 20 puntos.
        </Highlight>
      </Section>

      {/* ===== 3. APUESTAS ESPECIALES ===== */}
      <Section icon="🎲" title="3. Apuestas especiales" badge="Pre-torneo">
        <P last>Predicciones extra sobre el torneo. Se rellenan antes del inicio del Mundial.</P>
        <ItemTable items={[
          { label: 'Selección revelación (llega a cuartos)', value: '4 puntos', color: '#4ade80' },
          { label: 'Selección decepción (cae en grupos)', value: '4 puntos', color: '#4ade80' },
          { label: 'Máximo goleador', value: 'Según categoría', color: 'var(--text-secondary)' },
          { label: 'Máximo asistente', value: 'Según categoría', color: 'var(--text-secondary)' },
          { label: 'Mejor portero', value: 'Según categoría', color: 'var(--text-secondary)' },
          { label: 'Más goleadora / Menos goleada en grupos', value: '3 pts cada una', color: 'var(--text-secondary)' },
          { label: '¿Habrá hat-trick? ¿Goleada 5+?', value: 'Sí / No', color: 'var(--text-secondary)' }
        ]} />
      </Section>

      {/* ===== PHASE DIVIDER: DURANTE ===== */}
      <PhaseDivider label="DURANTE EL MUNDIAL" subtitle="Nuevas oportunidades de sumar (y perder) puntos" color="#4ade80" />

      {/* ===== 4. CUADRO REAL ===== */}
      <Section icon="⚡" title="4. Cuadro real" badge="31 partidos">
        <P>Cuando termine la fase de grupos y se conozca el cuadro real, se abre una nueva ronda de predicciones.</P>
        <P>Ahora predices el resultado exacto a 90 minutos de cada partido eliminatorio (igual que en grupos).</P>
        <Highlight>
          Importante: predices el resultado a los 90 minutos, no quién pasa de ronda.{'\n'}
          Puedes predecir un empate (ej: 1-1) aunque sea eliminatoria — el partido se resuelve en prórroga/penaltis, pero tú apuestas al marcador de los 90'.
        </Highlight>
        <ItemTable items={[
          { label: 'Resultado exacto', value: '3 puntos', color: '#4ade80' },
          { label: 'Signo correcto (1X2)', value: '1 punto', color: 'var(--gold)' },
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
      <Section icon="🔥" title="5. Órdagos" badge="6 disponibles">
        <P>Los órdagos son apuestas especiales a partidos concretos con mayor recompensa, pero con un coste de entrada.</P>

        <div style={{
          margin: '12px 0', padding: '12px',
          background: 'rgba(255,204,0,0.06)', border: '0.5px solid rgba(255,204,0,0.15)',
          borderRadius: '8px', fontSize: '12px', lineHeight: '1.6', color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--gold)' }}>¿Cómo funcionan?</strong><br />
          • Se desbloquean uno a uno: hasta que no pase el anterior, no ves el siguiente.{'\n'}
          • Puedes participar hasta 2 horas antes del partido.{'\n'}
          • Son 100% opcionales — si no participas, ni ganas ni pierdes.{'\n'}
          • Pagas un coste de entrada en puntos. Si aciertas, ganas más de lo que pagas. Si fallas, pierdes el coste.
        </div>

        <Highlight>
          Ejemplo — Órdago #4 (un octavo de final, coste 2 pts):{'\n'}
          Predices Francia 2-1 Brasil.{'\n'}
          → Si es exacto: ganas +6 pts, pagas -2 = neto +4{'\n'}
          → Si Francia gana por otro marcador: ganas +4 pts, pagas -2 = neto +2{'\n'}
          → Si fallas: ganas 0, pagas -2 = neto -2
        </Highlight>

        {/* Órdagos table */}
        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '0.5px solid var(--border)' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 50px 50px 50px',
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
            { n: 1, match: 'España (1er partido)', cost: 'GRATIS', exact: '+2', sign: '+1', free: true },
            { n: 2, match: 'Mejor partido J3', cost: '-1', exact: '+3', sign: '+2' },
            { n: 3, match: 'Un dieciseisavo', cost: '-1', exact: '+3', sign: '+2' },
            { n: 4, match: 'Un octavo de final', cost: '-2', exact: '+6', sign: '+4' },
            { n: 5, match: 'Un cuarto de final', cost: '-2', exact: '+6', sign: '+4' },
            { n: 6, match: 'Una semifinal', cost: '-3', exact: '+9', sign: '+6' }
          ].map((o, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 50px 50px 50px',
              padding: '9px 10px', fontSize: '12px',
              borderTop: '0.5px solid var(--border-light)',
              background: o.free ? 'rgba(0,122,69,0.04)' : 'transparent'
            }}>
              <span style={{ fontWeight: '700', color: 'var(--text-dim)' }}>{o.n}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{o.match}</span>
              <span style={{ textAlign: 'center', fontWeight: '600', color: o.free ? 'var(--green)' : '#e74c3c' }}>{o.cost}</span>
              <span style={{ textAlign: 'center', fontWeight: '600', color: '#4ade80' }}>{o.exact}</span>
              <span style={{ textAlign: 'center', fontWeight: '600', color: 'var(--gold)' }}>{o.sign}</span>
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

      {/* ===== RESUMEN VISUAL ===== */}
      <Section icon="📊" title="Resumen del sistema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { label: 'Fase de grupos', detail: '72 partidos × (3 exacto / 1 signo)', phase: 'antes' },
            { label: 'Cuadro ciego', detail: 'Quién avanza cada ronda', phase: 'antes' },
            { label: 'Apuestas especiales', detail: 'Goleador, revelación, etc.', phase: 'antes' },
            { label: 'Cuadro real', detail: '31 partidos × (3 exacto / 1 signo)', phase: 'durante' },
            { label: 'Órdagos', detail: '6 apuestas con coste de entrada', phase: 'durante' }
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: 'var(--bg-input)', borderRadius: '6px'
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{row.label}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '8px' }}>{row.detail}</span>
              </div>
              <span style={{
                fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: '600',
                background: row.phase === 'antes' ? 'rgba(255,138,138,0.1)' : 'rgba(74,222,128,0.1)',
                color: row.phase === 'antes' ? '#ff8a8a' : '#4ade80',
                textTransform: 'uppercase', letterSpacing: '0.3px'
              }}>
                {row.phase}
              </span>
            </div>
          ))}
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
          { label: 'Final del Mundial', value: '19 de julio de 2026', color: 'var(--gold)' }
        ]} />
      </Section>

      {/* ===== REGLAS GENERALES ===== */}
      <Section icon="🔒" title="Reglas generales">
        <BulletList items={[
          'No se pueden modificar predicciones una vez cerrado el plazo.',
          'Las apuestas de otros participantes no son visibles hasta que cierre el plazo.',
          'La inscripción debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.',
          'Los órdagos son 100% opcionales.',
          'El organizador se reserva el derecho de resolver disputas.'
        ]} />
      </Section>

      <div style={{ height: '20px' }} />
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
            background: 'var(--bg-input)', color: 'var(--text-dim)',
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
