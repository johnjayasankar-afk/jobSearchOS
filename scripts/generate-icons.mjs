// Generates the app icon set as real PNGs with zero dependencies.
// The mark: three ascending rounded bars (a pipeline advancing) on a near-black tile.
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'public/icons')
fs.mkdirSync(OUT, { recursive: true })

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- tiny software rasterizer (4x supersampled coverage) -------------------
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4)
  return {
    size,
    buf,
    fill(shapeFn, [r, g, b], alpha = 1) {
      const S = 3 // supersample factor
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let hits = 0
          for (let sy = 0; sy < S; sy++) {
            for (let sx = 0; sx < S; sx++) {
              if (shapeFn(x + (sx + 0.5) / S, y + (sy + 0.5) / S)) hits++
            }
          }
          if (!hits) continue
          const a = (hits / (S * S)) * alpha
          const i = (y * size + x) * 4
          const da = buf[i + 3] / 255
          const oa = a + da * (1 - a)
          buf[i] = Math.round((r * a + buf[i] * da * (1 - a)) / oa)
          buf[i + 1] = Math.round((g * a + buf[i + 1] * da * (1 - a)) / oa)
          buf[i + 2] = Math.round((b * a + buf[i + 2] * da * (1 - a)) / oa)
          buf[i + 3] = Math.round(oa * 255)
        }
      }
    },
  }
}

const roundRect = (x, y, w, h, r) => (px, py) => {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r)
  const cy = Math.min(Math.max(py, y + r), y + h - r)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

const INK = [12, 14, 18]
const ACCENT = [59, 118, 240]
const DIM = [110, 122, 145]
const DIM2 = [78, 88, 108]

function drawMark(c, { pad = 0, tile = true } = {}) {
  const s = c.size
  const u = s / 100
  if (tile) c.fill(roundRect(0, 0, s, s, 22 * u), INK)
  // inner content box
  const box = s - pad * 2
  const bu = box / 100
  const ox = pad
  const oy = pad
  const barW = 15 * bu
  const gap = 10.5 * bu
  const baseY = oy + 74 * bu
  const startX = ox + 22 * bu
  const heights = [26, 40, 56]
  const colors = [DIM2, DIM, ACCENT]
  for (let i = 0; i < 3; i++) {
    const h = heights[i] * bu
    c.fill(roundRect(startX + i * (barW + gap), baseY - h, barW, h, barW / 2), colors[i])
  }
}

function render(size, { padRatio = 0, tile = true } = {}) {
  const c = makeCanvas(size)
  drawMark(c, { pad: size * padRatio, tile })
  return encodePng(size, size, c.buf)
}

const files = [
  ['icon-192.png', render(192)],
  ['icon-512.png', render(512)],
  // maskable icons need a safe zone: keep the mark inside the inner 80%
  ['icon-maskable-192.png', render(192, { padRatio: 0.12 })],
  ['icon-maskable-512.png', render(512, { padRatio: 0.12 })],
  ['apple-touch-icon.png', render(180)],
  ['favicon-32.png', render(32)],
]
for (const [name, data] of files) {
  fs.writeFileSync(path.join(OUT, name), data)
  console.log('wrote', name, data.length, 'bytes')
}
