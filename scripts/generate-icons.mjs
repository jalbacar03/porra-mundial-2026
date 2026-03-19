import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size / 512 // scale factor

  // Background with rounded corners (fill full, mask not needed for PNG)
  ctx.fillStyle = '#1a1d26'
  ctx.fillRect(0, 0, size, size)

  // Football/star circle
  const cx = size / 2
  const cy = 200 * s

  // Green circle outline
  ctx.beginPath()
  ctx.arc(cx, cy, 120 * s, 0, Math.PI * 2)
  ctx.strokeStyle = '#007a45'
  ctx.lineWidth = 10 * s
  ctx.stroke()

  // 5-point star inside the circle
  ctx.fillStyle = '#007a45'
  ctx.beginPath()
  const starR = 80 * s
  const starInner = 35 * s
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2
    const innerAngle = outerAngle + Math.PI / 5
    const ox = cx + Math.cos(outerAngle) * starR
    const oy = cy + Math.sin(outerAngle) * starR
    const ix = cx + Math.cos(innerAngle) * starInner
    const iy = cy + Math.sin(innerAngle) * starInner
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  ctx.fill()

  // Text "PM" in white
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${72 * s}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PM', cx, 390 * s)

  // Text "26" in gold
  ctx.fillStyle = '#ffcc00'
  ctx.font = `bold ${64 * s}px sans-serif`
  ctx.fillText('26', cx, 460 * s)

  return canvas.toBuffer('image/png')
}

writeFileSync('public/icon-512.png', drawIcon(512))
writeFileSync('public/icon-192.png', drawIcon(192))
console.log('Icons generated: icon-512.png, icon-192.png')
