#!/usr/bin/env node
// node tools/land-dots.mjs <ne_110m_land.geojson> [step=3] > data/land-dots-3.json
// Samples land as evenly spaced points on the sphere (spacing `step` degrees
// along a great circle), for sphere({ dots }). Source: Natural Earth 110m
// land, public domain: github.com/nvkelso/natural-earth-vector/geojson.
import { readFileSync } from 'node:fs'

const [file, stepArg] = process.argv.slice(2)
const step = +(stepArg || 3)
const gj = JSON.parse(readFileSync(file, 'utf8'))
const polys = gj.features.flatMap((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)

const inRing = (x, y, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const isLand = (lon, lat) => polys.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)))

const pts = []
for (let lat = -90 + step / 2; lat < 90; lat += step) {
  const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step))
  const off = (lat / step) % 2 ? 0.5 : 0 // stagger rows so dots tile, not stack
  for (let k = 0; k < n; k++) {
    const lon = -180 + ((k + off) * 360) / n
    if (isLand(lon, lat)) pts.push([Math.round(lat * 10) / 10, Math.round(lon * 10) / 10])
  }
}
process.stdout.write(JSON.stringify(pts))
