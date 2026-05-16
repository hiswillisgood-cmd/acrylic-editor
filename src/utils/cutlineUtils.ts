export interface Point { x: number; y: number }

function lineLineIntersect(
  p1x: number, p1y: number, d1x: number, d1y: number,
  p2x: number, p2y: number, d2x: number, d2y: number,
): Point | null {
  const det = -d1x * d2y + d2x * d1y
  if (Math.abs(det) < 1e-10) return null
  const t = (-(p2x - p1x) * d2y + d2x * (p2y - p1y)) / det
  return { x: p1x + t * d1x, y: p1y + t * d1y }
}

// 두 선분 교점 (t,u 모두 0~1 범위 안일 때만)
function segmentIntersect(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y
  const det = d1x * d2y - d1y * d2x
  if (Math.abs(det) < 1e-10) return null
  const dx = b1.x - a1.x, dy = b1.y - a1.y
  const t = (dx * d2y - dy * d2x) / det
  const u = (dx * d1y - dy * d1x) / det
  const eps = 1e-6
  if (t < eps || t > 1 - eps || u < eps || u > 1 - eps) return null
  return { x: a1.x + t * d1x, y: a1.y + t * d1y }
}

// 비인접 두 변이 교차하면 그 사이 짧은 구간을 교점으로 대체 (loop 제거)
function removeSelfIntersections(poly: Point[], maxIter = 30): Point[] {
  let result = poly.slice()
  for (let iter = 0; iter < maxIter; iter++) {
    const n = result.length
    if (n < 4) break
    let foundI = -1, foundJ = -1, foundPt: Point | null = null
    outer: for (let i = 0; i < n; i++) {
      const a1 = result[i], a2 = result[(i + 1) % n]
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue
        const ip = segmentIntersect(a1, a2, result[j], result[(j + 1) % n])
        if (ip) { foundI = i; foundJ = j; foundPt = ip; break outer }
      }
    }
    if (foundPt == null) break
    const innerLen = foundJ - foundI
    const outerLen = n - innerLen
    if (innerLen <= outerLen) {
      result = [...result.slice(0, foundI + 1), foundPt, ...result.slice(foundJ + 1)]
    } else {
      result = [foundPt, ...result.slice(foundI + 1, foundJ + 1)]
    }
  }
  return result
}

// 폴리곤 평행 offset — winding-aware 자체 구현
// — 볼록 모서리는 호(arc), 오목 모서리는 교점
// — 후처리로 self-intersection 정리
export function offsetParallel(points: Point[], offset: number): Point[] {
  const n = points.length
  if (n < 3 || offset === 0) return points

  let area = 0
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n]
    area += p.x * q.y - q.x * p.y
  }
  const isCW = area > 0

  const raw: Point[] = []

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]

    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y
    const len1 = Math.hypot(dx1, dy1) || 1
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y
    const len2 = Math.hypot(dx2, dy2) || 1

    const sign = isCW ? 1 : -1
    const nx1 = sign * dy1 / len1,  ny1 = -sign * dx1 / len1
    const nx2 = sign * dy2 / len2,  ny2 = -sign * dx2 / len2

    const dot = nx1 * nx2 + ny1 * ny2
    if (dot > 0.9999) {
      raw.push({ x: curr.x + nx1 * offset, y: curr.y + ny1 * offset })
      continue
    }

    const cross = dx1 * dy2 - dy1 * dx2
    const isConvex = isCW ? cross > 0 : cross < 0

    if (isConvex) {
      // 볼록 모서리 → 호로 채움
      const p1x = curr.x + nx1 * offset, p1y = curr.y + ny1 * offset
      const p2x = curr.x + nx2 * offset, p2y = curr.y + ny2 * offset
      let a1 = Math.atan2(p1y - curr.y, p1x - curr.x)
      const a2 = Math.atan2(p2y - curr.y, p2x - curr.x)
      let diff = a2 - a1
      while (diff > Math.PI)  diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      const steps = Math.max(1, Math.ceil(Math.abs(diff) / (Math.PI / 12)))
      for (let k = 0; k <= steps; k++) {
        const a = a1 + diff * (k / steps)
        raw.push({ x: curr.x + Math.cos(a) * Math.abs(offset), y: curr.y + Math.sin(a) * Math.abs(offset) })
      }
    } else {
      // 오목 모서리 → 교점
      const p1x = curr.x + nx1 * offset, p1y = curr.y + ny1 * offset
      const p2x = curr.x + nx2 * offset, p2y = curr.y + ny2 * offset
      const ix = lineLineIntersect(p1x, p1y, dx1, dy1, p2x, p2y, dx2, dy2)
      if (ix && Math.hypot(ix.x - curr.x, ix.y - curr.y) < Math.abs(offset) * 4) {
        raw.push(ix)
      } else {
        raw.push({ x: (p1x + p2x) / 2, y: (p1y + p2y) / 2 })
      }
    }
  }

  // 인접 중복점(< minDist) 제거 후 self-intersection 정리
  return removeSelfIntersections(dedupClose(raw, 1.0))
}

// 인접한 거리 minDist 미만 점을 합쳐서 미세 zigzag 제거
function dedupClose(poly: Point[], minDist: number): Point[] {
  if (poly.length < 2) return poly
  const out: Point[] = [poly[0]]
  for (let i = 1; i < poly.length; i++) {
    const last = out[out.length - 1]
    if (Math.hypot(poly[i].x - last.x, poly[i].y - last.y) >= minDist) out.push(poly[i])
  }
  // wrap-around 마지막-처음 거리도 검사
  if (out.length > 2) {
    const first = out[0], last = out[out.length - 1]
    if (Math.hypot(first.x - last.x, first.y - last.y) < minDist) out.pop()
  }
  return out
}

// 폴리곤을 count개 점으로 균등 리샘플링
export function resampleEvenly(points: Point[], count: number): Point[] {
  if (points.length < 2 || count < 3) return points
  const n = points.length
  const cumLen = [0]
  for (let i = 1; i <= n; i++) {
    const a = points[(i - 1) % n], b = points[i % n]
    cumLen.push(cumLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cumLen[n]
  if (total < 1) return points

  const step = total / count
  const result: Point[] = []
  let seg = 0
  for (let i = 0; i < count; i++) {
    const target = i * step
    while (seg < n - 1 && cumLen[seg + 1] < target) seg++
    const t = cumLen[seg + 1] > cumLen[seg]
      ? (target - cumLen[seg]) / (cumLen[seg + 1] - cumLen[seg])
      : 0
    const a = points[seg % n], b = points[(seg + 1) % n]
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return result
}
