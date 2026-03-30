/**
 * Generate "Normas y Puntuación" Word document
 * Usage: node scripts/generate-normas-doc.js
 */
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak, PageNumber
} = require('docx')

const GREEN = '007A45'
const GOLD = 'B8860B'
const LIGHT_GREEN = 'E8F5E9'
const LIGHT_GRAY = 'F5F5F5'
const WHITE = 'FFFFFF'
const DARK = '333333'

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: border, bottom: border, left: border, right: border }
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

// Table width for A4 with 1" margins
const TABLE_W = 9026

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: GREEN, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: 'center',
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: WHITE, font: 'Arial', size: 20 })] })]
  })
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shade ? { fill: LIGHT_GREEN, type: ShadingType.CLEAR } : opts.gray ? { fill: LIGHT_GRAY, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, font: 'Arial', size: 20, bold: opts.bold, color: opts.color || DARK })]
    })]
  })
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, font: 'Arial', bold: true, color: GREEN, size: level === HeadingLevel.HEADING_1 ? 28 : 24 })] })
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text, font: 'Arial', size: 20, bold: opts.bold, italics: opts.italic, color: opts.color || DARK })]
  })
}

function spacer() { return new Paragraph({ spacing: { after: 60 }, children: [] }) }

// ── BUILD DOC ──

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Arial', color: GREEN }, paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Arial', color: GREEN }, paragraph: { spacing: { before: 240, after: 150 }, outlineLevel: 1 } }
    ]
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'PORRA MUNDIAL 2026', font: 'Arial', size: 16, color: GREEN, bold: true })] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: 'Porra Mundial 2026 \u2014 porra-mundial-2026-omega.vercel.app \u2014 P\u00e1gina ', font: 'Arial', size: 16, color: '888888' }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '888888' })
      ] })] })
    },
    children: [
      // ── TITLE ──
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'PORRA MUNDIAL 2026', font: 'Arial', size: 40, bold: true, color: GREEN })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Normas y Puntuaci\u00f3n', font: 'Arial', size: 28, color: GOLD })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Gu\u00eda completa del sistema de puntuaci\u00f3n', font: 'Arial', size: 20, italics: true, color: '666666' })] }),

      // ── 1. QUÉ ES ──
      heading('\u00bfQu\u00e9 es la Porra Mundial 26?'),
      para('Una porra amistosa de predicciones entre amigos para el Mundial 2026. No es una casa de apuestas \u2014 es un juego entre amigos sin \u00e1nimo de lucro.'),
      para('El que m\u00e1s puntos acumule al final del torneo, gana.'),
      spacer(),

      // ── 2. RESUMEN RÁPIDO ──
      heading('Resumen r\u00e1pido de puntuaci\u00f3n'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [3000, 3026, 3000],
        rows: [
          new TableRow({ children: [headerCell('Categor\u00eda', 3000), headerCell('Detalle', 3026), headerCell('Puntuaci\u00f3n', 3000)] }),
          new TableRow({ children: [cell('1. Fase de grupos', 3000, { bold: true }), cell('72 partidos', 3026), cell('Exacto +3 / Signo +1 / Fallo 0', 3000, { center: true })] }),
          new TableRow({ children: [cell('2. Cuadro ciego', 3000, { bold: true, gray: true }), cell('Qui\u00e9n avanza cada ronda', 3026, { gray: true }), cell('Hasta +20 pts', 3000, { center: true, gray: true })] }),
          new TableRow({ children: [cell('3. Especiales', 3000, { bold: true }), cell('Goleador, revelaci\u00f3n...', 3026), cell('+2 pts por apuesta', 3000, { center: true })] }),
          new TableRow({ children: [cell('4. Cuadro real', 3000, { bold: true, gray: true }), cell('31 partidos eliminatorias', 3026, { gray: true }), cell('Exacto +3 / Signo +1 / Fallo 0', 3000, { center: true, gray: true })] }),
          new TableRow({ children: [cell('5. \u00d3rdagos', 3000, { bold: true }), cell('6 apuestas opcionales', 3026), cell('Hasta +9 pero con coste', 3000, { center: true })] }),
        ]
      }),
      spacer(),

      // ── ANTES DEL MUNDIAL ──
      new Paragraph({ spacing: { before: 300, after: 200 }, alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '\u2500\u2500\u2500  ANTES DEL MUNDIAL  \u2500\u2500\u2500', font: 'Arial', size: 24, bold: true, color: 'CC3333' })
      ] }),
      para('Deadline: 9 de junio de 2026 (48h antes del inicio del Mundial)', { italic: true, color: 'CC3333', center: true }),
      spacer(),

      // 3.1 FASE DE GRUPOS
      heading('1. Fase de grupos (72 partidos)', HeadingLevel.HEADING_2),
      para('Predices el resultado exacto (goles de cada equipo) de los 72 partidos de la fase de grupos.'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [5513, 3513],
        rows: [
          new TableRow({ children: [headerCell('Resultado', 5513), headerCell('Puntos', 3513)] }),
          new TableRow({ children: [cell('Resultado exacto', 5513), cell('+3 puntos', 3513, { center: true, bold: true, color: GREEN })] }),
          new TableRow({ children: [cell('Signo correcto (1X2)', 5513, { gray: true }), cell('+1 punto', 3513, { center: true, bold: true, color: GREEN, gray: true })] }),
          new TableRow({ children: [cell('Fallo', 5513), cell('0 puntos', 3513, { center: true })] }),
        ]
      }),
      spacer(),
      para('Ejemplo: predices Espa\u00f1a 2-1 Croacia.', { bold: true }),
      para('\u2022 Si el resultado real es 2-1 \u2192 3 puntos (exacto)'),
      para('\u2022 Si es 1-0 \u2192 1 punto (acertaste que ganaba Espa\u00f1a)'),
      para('\u2022 Si es 0-0 \u2192 0 puntos (fallaste el signo)'),
      spacer(),

      // 3.2 CUADRO CIEGO
      heading('2. Cuadro ciego (Pre-torneo)', HeadingLevel.HEADING_2),
      para('Antes del Mundial, montas tu cuadro eliminatorio completo: desde dieciseisavos hasta el campe\u00f3n.'),
      para('Los dieciseisavos se auto-rellenan desde tus predicciones de grupo (1\u00ba y 2\u00ba de cada grupo + 8 mejores terceros). A partir de ah\u00ed, eliges qui\u00e9n gana cada eliminatoria.'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [5513, 3513],
        rows: [
          new TableRow({ children: [headerCell('Ronda', 5513), headerCell('Puntos por acierto', 3513)] }),
          new TableRow({ children: [cell('Dieciseisavos (R32)', 5513), cell('0 pts (auto)', 3513, { center: true })] }),
          new TableRow({ children: [cell('Octavos de final (\u00d78)', 5513, { gray: true }), cell('+1 pt', 3513, { center: true, bold: true, color: GREEN, gray: true })] }),
          new TableRow({ children: [cell('Cuartos de final (\u00d74)', 5513), cell('+2 pts', 3513, { center: true, bold: true, color: GREEN })] }),
          new TableRow({ children: [cell('Semifinales (\u00d72)', 5513, { gray: true }), cell('+4 pts', 3513, { center: true, bold: true, color: GREEN, gray: true })] }),
          new TableRow({ children: [cell('Final (\u00d71)', 5513), cell('+5 pts', 3513, { center: true, bold: true, color: GREEN })] }),
          new TableRow({ children: [cell('Campe\u00f3n', 5513, { bold: true, shade: true }), cell('+8 pts', 3513, { center: true, bold: true, color: GREEN, shade: true })] }),
        ]
      }),
      spacer(),
      para('Si aciertas toda la cadena de tu campe\u00f3n (desde octavos hasta ganar la final), sumas hasta 20 puntos (1+2+4+5+8).', { bold: true }),
      spacer(),

      // 3.3 APUESTAS ESPECIALES
      heading('3. Apuestas especiales (Pre-torneo)', HeadingLevel.HEADING_2),
      para('Predicciones extra sobre el torneo. Se rellenan antes del inicio del Mundial.'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [7026, 2000],
        rows: [
          new TableRow({ children: [headerCell('Apuesta', 7026), headerCell('Puntos', 2000)] }),
          ...[
            ['Selecci\u00f3n revelaci\u00f3n (llega a cuartos)', '+2 pts'],
            ['Selecci\u00f3n decepci\u00f3n (cae en grupos)', '+2 pts'],
            ['M\u00e1ximo goleador del torneo', '+2 pts'],
            ['M\u00e1ximo asistente del torneo', '+2 pts'],
            ['Mejor portero (menos goles encajados)', '+2 pts'],
            ['Jugador con 3+ goles en el torneo', '+2 pts'],
            ['Selecci\u00f3n m\u00e1s goleadora en grupos', '+2 pts'],
            ['Selecci\u00f3n menos goleada en grupos', '+2 pts'],
            ['\u00bfHabr\u00e1 hat-trick en el torneo?', '+2 pts'],
            ['\u00bfHabr\u00e1 goleada de 5+ goles?', '+2 pts'],
          ].map(([name, pts], i) => new TableRow({ children: [
            cell(name, 7026, i % 2 === 1 ? { gray: true } : {}),
            cell(pts, 2000, { center: true, bold: true, color: GREEN, ...(i % 2 === 1 ? { gray: true } : {}) })
          ] }))
        ]
      }),
      spacer(),

      // ── PAGE BREAK ──
      new Paragraph({ children: [new PageBreak()] }),

      // ── DURANTE EL MUNDIAL ──
      new Paragraph({ spacing: { before: 100, after: 200 }, alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: '\u2500\u2500\u2500  DURANTE EL MUNDIAL  \u2500\u2500\u2500', font: 'Arial', size: 24, bold: true, color: GREEN })
      ] }),
      para('Nuevas oportunidades de sumar (y perder) puntos', { italic: true, color: GREEN, center: true }),
      spacer(),

      // 4.1 CUADRO REAL
      heading('4. Cuadro real (31 partidos eliminatorios)', HeadingLevel.HEADING_2),
      para('Cuando termine la fase de grupos y se conozca el cuadro real, se abre una nueva ronda de predicciones.'),
      para('Predices el resultado exacto a 90 minutos de cada partido eliminatorio (igual que en grupos). Puedes predecir un empate \u2014 el partido se resuelve en pr\u00f3rroga/penaltis, pero t\u00fa apuestas al marcador de los 90 minutos.'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [5513, 3513],
        rows: [
          new TableRow({ children: [headerCell('Resultado', 5513), headerCell('Puntos', 3513)] }),
          new TableRow({ children: [cell('Resultado exacto', 5513), cell('+3 puntos', 3513, { center: true, bold: true, color: GREEN })] }),
          new TableRow({ children: [cell('Signo correcto (1X2)', 5513, { gray: true }), cell('+1 punto', 3513, { center: true, bold: true, color: GREEN, gray: true })] }),
          new TableRow({ children: [cell('Fallo', 5513), cell('0 puntos', 3513, { center: true })] }),
        ]
      }),
      para('Deadline: antes de que empiece cada ronda (ej: debes predecir los octavos antes de que se juegue el primer octavo).', { italic: true, after: 200 }),
      para('\u00bfSe solapan cuadro ciego y cuadro real? No. Son predicciones distintas y sumas ambas. En el cuadro ciego predices qui\u00e9n avanza; en el cuadro real predices el marcador.', { bold: true }),
      spacer(),

      // 4.2 ÓRDAGOS
      heading('5. \u00d3rdagos (6 apuestas OPCIONALES)', HeadingLevel.HEADING_2),
      para('\u26a0\ufe0f Los \u00f3rdagos son 100% opcionales. Si no participas, ni ganas ni pierdes puntos.', { bold: true, color: GOLD }),
      para('Apuestas especiales a partidos concretos con mayor recompensa, pero con un coste de entrada en puntos. Se desbloquean en secuencia. Puedes participar hasta 3 horas antes del partido.'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [500, 3026, 2000, 1200, 1100, 1200],
        rows: [
          new TableRow({ children: [headerCell('#', 500), headerCell('Partido', 3026), headerCell('Fecha', 2000), headerCell('Coste', 1200), headerCell('Exacto', 1100), headerCell('1X2', 1200)] }),
          ...[
            ['1', 'Inglaterra vs Croacia', '17 jun 22:00h', 'GRATIS', '+2', '+1'],
            ['2', 'Uruguay vs Espa\u00f1a', '27 jun', '-1', '+3', '+2'],
            ['3', '1er partido dieciseisavos', '28 jun 21:00h', '-1', '+3', '+2'],
            ['4', '2\u00ba partido de octavos', '4 jul 23:00h', '-2', '+6', '+4'],
            ['5', '1er partido de cuartos', '9 jul 22:00h', '-2', '+6', '+4'],
            ['6', '2\u00aa semifinal', '15 jul 21:00h', '-3', '+9', '+6'],
          ].map(([n, partido, fecha, coste, exacto, sign], i) => new TableRow({ children: [
            cell(n, 500, { center: true, bold: true, ...(i % 2 === 1 ? { gray: true } : {}) }),
            cell(partido, 3026, { bold: true, ...(i % 2 === 1 ? { gray: true } : {}) }),
            cell(fecha, 2000, { center: true, ...(i % 2 === 1 ? { gray: true } : {}) }),
            cell(coste, 1200, { center: true, bold: true, color: coste === 'GRATIS' ? GREEN : 'CC3333', ...(i % 2 === 1 ? { gray: true } : {}) }),
            cell(exacto, 1100, { center: true, bold: true, color: GREEN, ...(i % 2 === 1 ? { gray: true } : {}) }),
            cell(sign, 1200, { center: true, bold: true, color: GREEN, ...(i % 2 === 1 ? { gray: true } : {}) }),
          ] }))
        ]
      }),
      spacer(),
      para('Si aciertas los 6 exactos: +20 pts netos. Si fallas los 6: -9 pts.', { bold: true }),
      spacer(),
      para('Ejemplo \u2014 \u00d3rdago #4 (2\u00ba partido de octavos, coste 2 pts):', { bold: true }),
      para('\u2022 Predices 2-1 para el equipo local.'),
      para('\u2022 Si es exacto: ganas +6, pagas -2 = neto +4'),
      para('\u2022 Si el local gana por otro marcador: ganas +4, pagas -2 = neto +2'),
      para('\u2022 Si fallas: ganas 0, pagas -2 = neto -2'),
      spacer(),

      // ── CLASIFICACIÓN ──
      heading('Clasificaci\u00f3n y desempate'),
      para('La clasificaci\u00f3n se actualiza autom\u00e1ticamente conforme se juegan los partidos.'),
      para('En caso de empate a puntos, desempata el mayor n\u00famero de resultados exactos conseguidos en la fase de grupos.'),
      para('La clasificaci\u00f3n de los "\u00daltimos 3 d\u00edas" es solo informativa \u2014 no cuenta para la puntuaci\u00f3n final.'),
      para('Bot365: participante ficticio cuyas predicciones se basan en las cuotas de las casas de apuestas. Sirve de referencia pero no compite.', { italic: true }),
      spacer(),

      // ── FECHAS CLAVE ──
      heading('Fechas clave'),
      new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: [5513, 3513],
        rows: [
          new TableRow({ children: [headerCell('Evento', 5513), headerCell('Fecha', 3513)] }),
          new TableRow({ children: [cell('Deadline predicciones pre-torneo', 5513), cell('9 de junio de 2026', 3513, { center: true, bold: true, color: 'CC3333' })] }),
          new TableRow({ children: [cell('Inicio del Mundial', 5513, { gray: true }), cell('11 de junio de 2026', 3513, { center: true, bold: true, gray: true })] }),
          new TableRow({ children: [cell('Final del Mundial', 5513), cell('19 de julio de 2026', 3513, { center: true, bold: true, color: GREEN })] }),
        ]
      }),
      spacer(),

      // ── REGLAS GENERALES ──
      heading('Reglas generales'),
      ...[
        'No se pueden modificar predicciones una vez cerrado el plazo.',
        'Las apuestas de otros participantes no son visibles hasta que cierre el plazo.',
        'La inscripci\u00f3n debe estar confirmada antes del inicio del Mundial para que tus predicciones cuenten.',
        'Los \u00f3rdagos son 100% opcionales \u2014 no participar no penaliza.',
        'El organizador se reserva el derecho de resolver disputas.'
      ].map(t => new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: t, font: 'Arial', size: 20, color: DARK })]
      })),
      spacer(),
      spacer(),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: '\u00a1Buena suerte a todos! \u26bd', font: 'Arial', size: 24, bold: true, color: GREEN })] }),
    ]
  }]
})

// Generate
const outPath = path.join(__dirname, '..', 'public', 'docs', 'normas-porra-mundial-2026.docx')
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer)
  console.log(`\u2705 Generated: ${outPath}`)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
