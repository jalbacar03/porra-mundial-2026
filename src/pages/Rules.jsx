export default function Rules() {
  // Genera el PDF de normas AL VUELO desde este mismo contenido → siempre en
  // sync con las reglas reales (antes era un PDF estático que se quedaba viejo).
  async function generateRulesPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'), import('jspdf-autotable'),
    ])
    const doc = new jsPDF()
    const W = doc.internal.pageSize.getWidth()
    const Hp = doc.internal.pageSize.getHeight()
    const M = 16
    const ACCENT = [22, 163, 74], DARK = [13, 27, 21], GOLD = [212, 175, 55], INK = [28, 31, 40], MUT = [120, 125, 135]
    let y = 0

    doc.setFillColor(...DARK); doc.rect(0, 0, W, 34, 'F'); doc.setFillColor(...ACCENT); doc.rect(0, 34, W, 1.4, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(235)
    doc.text('PORRA MUNDIAL ', M, 13)
    doc.setTextColor(...GOLD); doc.text('26', M + doc.getTextWidth('PORRA MUNDIAL '), 13)
    doc.setTextColor(255); doc.setFontSize(17); doc.text('Normas del torneo', M, 26)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200)
    doc.text('Mundial 2026 · USA · México · Canadá', W - M, 26, { align: 'right' })
    y = 46

    const ensure = (sp) => { if (y + sp > Hp - 16) { doc.addPage(); y = 18 } }
    const h2 = (t) => { ensure(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ACCENT); doc.text(t, M, y); y += 7 }
    const para = (t) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
      const lines = doc.splitTextToSize(t, W - 2 * M); ensure(lines.length * 5 + 2)
      doc.text(lines, M, y); y += lines.length * 5 + 3
    }
    const small = (t) => { ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUT); doc.text(t.toUpperCase(), M, y); y += 5 }
    const table = (rows) => {
      autoTable(doc, {
        startY: y, margin: { left: M, right: M }, theme: 'striped',
        styles: { fontSize: 9.5, cellPadding: 2.2, textColor: INK },
        alternateRowStyles: { fillColor: [247, 249, 251] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 40, textColor: ACCENT } },
        body: rows,
      })
      y = doc.lastAutoTable.finalY + 6
    }
    const note = (t) => {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5)
      const lines = doc.splitTextToSize(t, W - 2 * M - 8); ensure(lines.length * 5 + 8)
      doc.setFillColor(250, 246, 228); doc.roundedRect(M, y - 4, W - 2 * M, lines.length * 5 + 8, 2, 2, 'F')
      doc.setTextColor(130, 100, 15); doc.text(lines, M + 4, y + 2); y += lines.length * 5 + 10
    }

    para('Una porra de predicciones entre amigos para el Mundial 2026. Gana quien más puntos acumule al final del torneo.')

    h2('1. Fase de grupos')
    para('72 partidos. Predices el resultado exacto de cada uno.')
    table([['Resultado exacto', '+3'], ['Signo correcto (1X2)', '+1'], ['Fallo', '0']])

    h2('2. Cuadro ciego')
    para('Antes del Mundial montas tu cuadro eliminatorio. No predices marcadores: solo quién gana cada cruce. Puntúa GANAR el partido de cada ronda (= pasar de ronda), no estar en ella.')
    table([
      ['Llegar a 16avos (desde grupos)', '0'],
      ['Ganar en 16avos → octavos (x16)', '+1'],
      ['Ganar en octavos → cuartos (x8)', '+1'],
      ['Ganar en cuartos → semis (x4)', '+2'],
      ['Ganar en semis → final (x2)', '+4'],
      ['Ganar la final = campeón (x1)', '+8'],
    ])
    note('Cadena del campeón: 1 + 1 + 2 + 4 + 8 = 16 puntos. Máximo del cuadro: 48 pts.')

    h2('3. Predicciones especiales')
    para('Predicciones extra sobre el torneo, se rellenan antes del inicio.')
    small('Jugadores')
    table([['MVP del torneo', '+5'], ['Bota de Oro (máximo goleador)', '+3'], ['Máximo asistente', '+3'], ['Guante de Oro (mejor portero)', '+3']])
    small('Selecciones')
    table([['Revelación (llega a cuartos)', '+3'], ['Decepción (cae en grupos)', '+3'], ['Más goleadora en grupos', '+2'], ['Menos goleada en grupos', '+2']])
    small('¿Sí o No? (1 pt cada una)')
    table([['¿Hat-trick en el torneo?', '+1'], ['¿Goleada por 5+ de diferencia?', '+1'], ['¿Final en penaltis?', '+1'], ['¿Campeón europeo?', '+1'], ['¿Ambas rojas en un mismo partido?', '+1']])

    h2('4. Cuadro real (durante el Mundial)')
    para('Cuando se conozca el cuadro real, predices el resultado exacto a 90 minutos de cada eliminatoria (igual que en grupos). Puedes predecir empate aunque sea eliminatoria.')
    table([['Resultado exacto', '+3'], ['Signo correcto (1X2)', '+1'], ['Fallo', '0']])
    note('Cuadro ciego y cuadro real son predicciones distintas y sumas ambas: en el ciego predices quién avanza, en el real el marcador.')

    h2('Clasificación y desempate')
    para('La clasificación se actualiza automáticamente. En caso de empate a puntos, desempata el mayor número de resultados exactos en todo el torneo (grupos + eliminatorias).')

    h2('Fechas clave')
    table([['Cierre de predicciones pre-torneo', '9 jun 23:59'], ['Inicio del Mundial', '11 jun 2026'], ['Final del Mundial', '19 jul 2026']])

    h2('Reglas generales')
    ;[
      'No se pueden modificar predicciones una vez cerrado el plazo.',
      'Las predicciones de otros no son visibles hasta que empieza el Mundial.',
      'La inscripción debe estar confirmada antes del inicio para que cuenten tus predicciones.',
      'En el registro debes indicar nombre y apellido reales (así apareces en la clasificación y se te identifica para el premio).',
      'El organizador se reserva el derecho de resolver disputas.',
    ].forEach(t => para('•  ' + t))

    // Footer con nº de página
    const pages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT)
      doc.text('Porra Mundial 26 · Normas', M, Hp - 8)
      doc.text(`${i}/${pages}`, W - M, Hp - 8, { align: 'right' })
    }
    doc.save('normas-porra-mundial-2026.pdf')
  }

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
          <button
            onClick={generateRulesPDF}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '8px 14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              cursor: 'pointer',
              border: '0.5px solid var(--border)',
              flexShrink: 0
            }}
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* ===== INTRO ===== */}
      <Section icon="🎯" title="¿Qué es la Porra Mundial 26?">
        <P>Una porra de predicciones entre amigos para el Mundial 2026.</P>
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
            { label: '2. Cuadro ciego', detail: 'Quién avanza cada ronda', pts: 'Hasta +16 pts (cadena campeón)', phase: 'antes' },
            { label: '3. Predicciones especiales', detail: '14 apuestas en 3 bloques', pts: 'Hasta +29 pts', phase: 'antes' },
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
      <PhaseDivider label="ANTES DEL MUNDIAL" subtitle="Deadline: 9 de junio de 2026, 23:59h" color="#ff8a8a" />

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
        <P>Los dieciseisavos se forman desde tus predicciones de grupo (1º y 2º de cada grupo + 8 mejores terceros). A partir de ahí, eliges quién gana cada eliminatoria.</P>
        <P last>Aquí no predices marcadores, solo quién gana cada cruce (es decir, quién pasa de ronda). Estar en una ronda no puntúa; puntúa ganar el partido de esa ronda.</P>
        <ItemTable items={[
          { label: 'Llegar a 16avos (desde grupos)', value: '0 pts', color: 'var(--text-dim)' },
          { label: 'Ganar en 16avos → octavos (×16)', value: '+1 pt', color: '#4ade80' },
          { label: 'Ganar en octavos → cuartos (×8)', value: '+1 pt', color: '#4ade80' },
          { label: 'Ganar en cuartos → semis (×4)', value: '+2 pts', color: '#4ade80' },
          { label: 'Ganar en semis → final (×2)', value: '+4 pts', color: '#4ade80' },
          { label: 'Ganar la final (campeón) (×1)', value: '+8 pts', color: '#4ade80' }
        ]} />
        <Highlight>
          Si clavas toda la cadena de tu campeón (gana en 16avos, octavos, cuartos, semis y final), sumas 1+1+2+4+8 = 16 puntos. Máximo del cuadro: 48 pts.
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
        <P>En caso de empate a puntos en la clasificación general, desempatará el mayor número de resultados exactos conseguidos durante todo el torneo (grupos + eliminatorias).</P>
        <P last>La clasificación de los "últimos 3 días" es solo informativa — no cuenta para la puntuación final.</P>
      </Section>

      {/* ===== FECHAS CLAVE ===== */}
      <Section icon="📅" title="Fechas clave">
        <ItemTable items={[
          { label: 'Deadline predicciones pre-torneo', value: '9 de junio, 23:59h', color: '#ff8a8a' },
          { label: 'Inicio del Mundial', value: '11 de junio de 2026', color: 'var(--text-primary)' },
          { label: 'Final del Mundial', value: '19 de julio de 2026', color: '#4ade80' }
        ]} />
      </Section>

      {/* ===== REGLAS GENERALES ===== */}
      <Section icon="🔒" title="Reglas generales">
        <BulletList items={[
          'No se pueden modificar predicciones una vez cerrado el plazo.',
          'Las predicciones de otros participantes no son visibles hasta que empieza el Mundial (11 de junio).',
          'La inscripción debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.',
          'En el registro debes indicar tu nombre y apellido reales: es como aparecerás en la clasificación y como te identificaremos para entregar el premio. Si no se puede identificar al ganador de forma inequívoca, no recibirá premio.',
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
