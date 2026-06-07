/**
 * Genera el PDF estático de Normas → public/docs/normas-porra-mundial-2026.pdf
 * Ejecutar: node scripts/gen-normas-pdf.mjs
 * Contenido alineado con src/pages/Rules.jsx (scoring cuadro 1-1-2-4-8).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { writeFileSync, mkdirSync } from 'node:fs'

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
doc.text('Mundial 2026 - USA - Mexico - Canada', W - M, 26, { align: 'right' })
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

para('Una porra de predicciones entre amigos para el Mundial 2026. Gana quien mas puntos acumule al final del torneo.')

h2('1. Fase de grupos')
para('72 partidos. Predices el resultado exacto de cada uno.')
table([['Resultado exacto', '+3'], ['Signo correcto (1X2)', '+1'], ['Fallo', '0']])

h2('2. Cuadro ciego')
para('Antes del Mundial montas tu cuadro eliminatorio. No predices marcadores: solo quien gana cada cruce. Puntua GANAR el partido de cada ronda (= pasar de ronda), no estar en ella.')
table([
  ['Llegar a 16avos (desde grupos)', '0'],
  ['Ganar en 16avos -> octavos (x16)', '+1'],
  ['Ganar en octavos -> cuartos (x8)', '+1'],
  ['Ganar en cuartos -> semis (x4)', '+2'],
  ['Ganar en semis -> final (x2)', '+4'],
  ['Ganar la final = campeon (x1)', '+8'],
])
note('Cadena del campeon: 1 + 1 + 2 + 4 + 8 = 16 puntos. Maximo del cuadro: 48 pts.')

h2('3. Predicciones especiales')
para('Predicciones extra sobre el torneo, se rellenan antes del inicio.')
small('Jugadores')
table([['MVP del torneo', '+5'], ['Bota de Oro (maximo goleador)', '+3'], ['Maximo asistente', '+3'], ['Guante de Oro (mejor portero)', '+3']])
small('Selecciones')
table([['Revelacion (llega a cuartos)', '+3'], ['Decepcion (cae en grupos)', '+3'], ['Mas goleadora en grupos', '+2'], ['Menos goleada en grupos', '+2']])
small('Si o No (1 pt cada una)')
table([['Hat-trick en el torneo?', '+1'], ['Goleada por 5+ de diferencia?', '+1'], ['Final en penaltis?', '+1'], ['Campeon europeo?', '+1'], ['Ambas rojas en un mismo partido?', '+1']])

h2('4. Cuadro real (durante el Mundial)')
para('Cuando se conozca el cuadro real, predices el resultado exacto a 90 minutos de cada eliminatoria (igual que en grupos). Puedes predecir empate aunque sea eliminatoria.')
table([['Resultado exacto', '+3'], ['Signo correcto (1X2)', '+1'], ['Fallo', '0']])
note('Cuadro ciego y cuadro real son predicciones distintas y sumas ambas: en el ciego predices quien avanza, en el real el marcador.')

h2('Clasificacion y desempate')
para('La clasificacion se actualiza automaticamente. En caso de empate a puntos, desempata el mayor numero de resultados exactos en todo el torneo (grupos + eliminatorias).')

h2('Fechas clave')
table([['Cierre de predicciones pre-torneo', '9 jun 23:59'], ['Inicio del Mundial', '11 jun 2026'], ['Final del Mundial', '19 jul 2026']])

h2('Reglas generales')
;[
  'No se pueden modificar predicciones una vez cerrado el plazo.',
  'Las predicciones de otros no son visibles hasta que empieza el Mundial.',
  'La inscripcion debe estar confirmada antes del inicio para que cuenten tus predicciones.',
  'En el registro debes indicar nombre y apellido reales (asi apareces en la clasificacion y se te identifica para el premio).',
  'El organizador se reserva el derecho de resolver disputas.',
].forEach(t => para('-  ' + t))

const pages = doc.internal.getNumberOfPages()
for (let i = 1; i <= pages; i++) {
  doc.setPage(i)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT)
  doc.text('Porra Mundial 26 - Normas', M, Hp - 8)
  doc.text(`${i}/${pages}`, W - M, Hp - 8, { align: 'right' })
}

mkdirSync('public/docs', { recursive: true })
writeFileSync('public/docs/normas-porra-mundial-2026.pdf', Buffer.from(doc.output('arraybuffer')))
console.log('OK → public/docs/normas-porra-mundial-2026.pdf')
