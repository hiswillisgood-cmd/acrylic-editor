/**
 * PNG 투명 영역 기반 자동 칼선 생성 (v4)
 *
 * 파이프라인:
 * 1. 경계 픽셀 추출 (불투명 & 인접 투명) → 수백~수천 포인트
 * 2. 경계 픽셀 순서 정렬 (nearest-neighbor chain)
 * 3. [NEW] Gaussian 1D 전처리 → 픽셀 단위 노이즈 제거
 * 4. Douglas-Peucker 축소 → 형상 특징점 (50~100개)
 * 5. Chaikin corner cutting 2회 → 부드럽게
 * 6. 균등 리샘플링
 * 7. [NEW] 병렬 오프셋 (볼록=Round Join, 오목=Intersection) → 균일 거리 칼선
 * 8. 베지어 변환 → SVG path
 *
 * 원형/타원 감지 → 해석적 피팅 (별도)
 */

export interface Point { x: number; y: number }

export interface ContourResult {
  outline: Point[]
  cutLine: Point[]
  svgOutline: string
  svgCutLine: string
}

const KAPPA = 0.5522847498

// ━━━ 1. 경계 픽셀 추출 ━━━

function extractBorderPixels(imageData: ImageData, threshold = 20): Point[] {
  const { width, height, data } = imageData
  const opaque = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && data[(y * width + x) * 4 + 3] >= threshold

  // Flood fill: 바깥 투명 영역 마킹 (좌상단 모서리에서 시작)
  const outside = new Uint8Array(width * height)
  const queue: number[] = []

  // 가장자리의 투명 픽셀을 모두 시작점으로
  for (let x = 0; x < width; x++) {
    if (!opaque(x, 0)) queue.push(x)
    if (!opaque(x, height - 1)) queue.push((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y++) {
    if (!opaque(0, y)) queue.push(y * width)
    if (!opaque(width - 1, y)) queue.push(y * width + width - 1)
  }
  for (const idx of queue) outside[idx] = 1

  // BFS flood fill
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % width, y = Math.floor(idx / width)
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const ni = ny * width + nx
      if (outside[ni] || opaque(nx, ny)) continue
      outside[ni] = 1
      queue.push(ni)
    }
  }

  // 바깥 투명과 접하는 불투명 픽셀 = 외곽 경계
  const border: Point[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue
      let isEdge = false
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) { isEdge = true; break }
        if (outside[ny * width + nx]) { isEdge = true; break }
      }
      if (isEdge) border.push({ x, y })
    }
  }
  return border
}

// ━━━ 2. 경계 픽셀 순서 정렬 (nearest-neighbor chain) ━━━

function orderByNearest(border: Point[]): Point[] {
  if (border.length < 3) return border

  const used = new Uint8Array(border.length)
  const ordered: Point[] = []

  let bestIdx = 0
  for (let i = 1; i < border.length; i++) {
    if (border[i].y < border[bestIdx].y ||
       (border[i].y === border[bestIdx].y && border[i].x < border[bestIdx].x)) {
      bestIdx = i
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of border) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y
  }
  const cellSize = 4
  const gw = Math.ceil((maxX - minX + 1) / cellSize) + 1
  const gh = Math.ceil((maxY - minY + 1) / cellSize) + 1
  const grid: number[][] = Array.from({ length: gw * gh }, () => [])
  for (let i = 0; i < border.length; i++) {
    const gx = Math.floor((border[i].x - minX) / cellSize)
    const gy = Math.floor((border[i].y - minY) / cellSize)
    grid[gy * gw + gx].push(i)
  }

  const findNearest = (px: number, py: number): number => {
    const gx = Math.floor((px - minX) / cellSize)
    const gy = Math.floor((py - minY) / cellSize)
    let best = -1, bestD = Infinity
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
        for (const idx of grid[ny * gw + nx]) {
          if (used[idx]) continue
          const d = (border[idx].x - px) ** 2 + (border[idx].y - py) ** 2
          if (d < bestD) { bestD = d; best = idx }
        }
      }
    }
    return best
  }

  const start = border[bestIdx]
  used[bestIdx] = 1
  ordered.push(start)
  let current = start

  for (let step = 1; step < border.length; step++) {
    const next = findNearest(current.x, current.y)
    if (next < 0) break
    used[next] = 1
    ordered.push(border[next])
    current = border[next]

    if (step > 20) {
      const distToStart = Math.hypot(current.x - start.x, current.y - start.y)
      if (distToStart < 3) break
    }
  }

  return ordered
}

// ━━━ 3. Gaussian 1D 전처리 (픽셀 노이즈 제거) ━━━

function gaussianSmooth1D(points: Point[], radius = 2): Point[] {
  const n = points.length
  if (n < 2 * radius + 1) return points

  const sigma = radius / 2.0
  const weights: number[] = []
  let wSum = 0
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma))
    weights.push(w)
    wSum += w
  }

  return points.map((_, idx) => {
    let sx = 0, sy = 0
    for (let k = 0; k < weights.length; k++) {
      const p = points[(idx + k - radius + n) % n]
      sx += p.x * weights[k]
      sy += p.y * weights[k]
    }
    return { x: sx / wSum, y: sy / wSum }
  })
}

// ━━━ 4. Douglas-Peucker ━━━

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points.slice()
  let maxDist = 0, maxIdx = 0
  const first = points[0], last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = ptLineDist(points[i], first, last)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon)
    const right = douglasPeucker(points.slice(maxIdx), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [first, last]
}

function ptLineDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// ━━━ 5. Chaikin Corner Cutting ━━━

function chaikinSmooth(points: Point[], iterations = 2): Point[] {
  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    const n = pts.length
    const next: Point[] = []
    for (let i = 0; i < n; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % n]
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 })
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 })
    }
    pts = next
  }
  return pts
}

// ━━━ 6. 균등 리샘플링 ━━━

function resampleEvenly(points: Point[], count: number): Point[] {
  if (points.length < 2 || count < 3) return points
  const n = points.length
  const cumLen: number[] = [0]
  for (let i = 1; i <= n; i++) {
    const p0 = points[(i - 1) % n], p1 = points[i % n]
    cumLen.push(cumLen[i - 1] + Math.hypot(p1.x - p0.x, p1.y - p0.y))
  }
  const totalLen = cumLen[n]
  if (totalLen < 1) return points

  const step = totalLen / count
  const result: Point[] = []
  let segIdx = 0
  for (let i = 0; i < count; i++) {
    const target = i * step
    while (segIdx < n - 1 && cumLen[segIdx + 1] < target) segIdx++
    const segStart = cumLen[segIdx], segEnd = cumLen[segIdx + 1]
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0
    const p0 = points[segIdx % n], p1 = points[(segIdx + 1) % n]
    result.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t })
  }
  return result
}

// ━━━ 7. 병렬 오프셋 (Round Join + Intersection) ━━━

/**
 * 직선 교점 계산
 * Line1: p1 + t * d1
 * Line2: p2 + s * d2
 */
function lineLineIntersect(
  p1x: number, p1y: number, d1x: number, d1y: number,
  p2x: number, p2y: number, d2x: number, d2y: number,
): Point | null {
  // det = d1x * (-d2y) - (-d2x) * d1y
  const det = -d1x * d2y + d2x * d1y
  if (Math.abs(det) < 1e-10) return null
  const dx = p2x - p1x, dy = p2y - p1y
  const t = (-dx * d2y + d2x * dy) / det
  return { x: p1x + t * d1x, y: p1y + t * d1y }
}

/**
 * 볼록 모서리 → Round Join (호)
 * 오목 모서리 → Intersection Join (교점)
 */
function offsetParallel(points: Point[], offset: number): Point[] {
  const n = points.length
  if (n < 3) return points

  // 폴리곤 감기 방향 감지 (화면 좌표 Y-down 기준)
  // 양수 → CW (화면 기준 시계방향), 음수 → CCW
  let area = 0
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n]
    area += p.x * q.y - q.x * p.y
  }
  const isCW = area > 0

  const result: Point[] = []

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]

    // 엣지 방향 벡터
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y
    const len1 = Math.hypot(dx1, dy1) || 1
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y
    const len2 = Math.hypot(dx2, dy2) || 1

    // 바깥쪽 법선 (CW → 우법선, CCW → 좌법선)
    const sign = isCW ? 1 : -1
    const nx1 = sign * dy1 / len1, ny1 = -sign * dx1 / len1
    const nx2 = sign * dy2 / len2, ny2 = -sign * dx2 / len2

    // 두 법선의 내적
    const dot = nx1 * nx2 + ny1 * ny2

    if (dot > 0.9999) {
      // 거의 평행한 엣지 → 단순 오프셋
      result.push({ x: curr.x + nx1 * offset, y: curr.y + ny1 * offset })
      continue
    }

    // 외적 (z성분): 양수 = CW 기준 오른쪽 회전 = 볼록
    const cross = dx1 * dy2 - dy1 * dx2
    const isConvex = isCW ? cross > 0 : cross < 0

    if (isConvex) {
      // ─── 볼록 모서리: Round Join (호로 부드럽게 연결) ───
      const p1x = curr.x + nx1 * offset, p1y = curr.y + ny1 * offset
      const p2x = curr.x + nx2 * offset, p2y = curr.y + ny2 * offset

      const angle1 = Math.atan2(p1y - curr.y, p1x - curr.x)
      const angle2 = Math.atan2(p2y - curr.y, p2x - curr.x)

      let angleDiff = angle2 - angle1
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      // 호를 구성하는 점 수 (최소 1, 최대 각도 비례)
      const arcSteps = Math.max(1, Math.ceil(Math.abs(angleDiff) / (Math.PI / 6)))
      for (let k = 0; k <= arcSteps; k++) {
        const a = angle1 + angleDiff * (k / arcSteps)
        result.push({
          x: curr.x + Math.cos(a) * offset,
          y: curr.y + Math.sin(a) * offset,
        })
      }
    } else {
      // ─── 오목 모서리: Intersection Join (교점) ───
      const p1x = curr.x + nx1 * offset, p1y = curr.y + ny1 * offset
      const p2x = curr.x + nx2 * offset, p2y = curr.y + ny2 * offset

      const ix = lineLineIntersect(p1x, p1y, dx1, dy1, p2x, p2y, dx2, dy2)
      if (ix) {
        // 너무 먼 교점(매우 날카로운 오목)은 중간값으로 대체
        const dist = Math.hypot(ix.x - curr.x, ix.y - curr.y)
        if (dist < Math.abs(offset) * 4) {
          result.push(ix)
        } else {
          result.push({ x: (p1x + p2x) / 2, y: (p1y + p2y) / 2 })
        }
      } else {
        result.push({ x: (p1x + p2x) / 2, y: (p1y + p2y) / 2 })
      }
    }
  }

  return result
}

// ━━━ 8. 베지어 SVG ━━━

function toBezierSVG(points: Point[], smoothing = 0.25): string {
  const n = points.length
  if (n < 3) return ''
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i]
    const p2 = points[(i + 1) % n], p3 = points[(i + 2) % n]
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const d1 = Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1
    const d2 = Math.hypot(p3.x - p1.x, p3.y - p1.y) || 1
    d += ` C ${(p1.x + ((p2.x - p0.x) / d1) * smoothing * segLen).toFixed(2)} ${(p1.y + ((p2.y - p0.y) / d1) * smoothing * segLen).toFixed(2)}, ${(p2.x - ((p3.x - p1.x) / d2) * smoothing * segLen).toFixed(2)} ${(p2.y - ((p3.y - p1.y) / d2) * smoothing * segLen).toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d + ' Z'
}

export function buildBezierSVG(points: Point[], smoothing: number): string {
  return toBezierSVG(points, smoothing)
}

// ━━━ 원형/타원 감지 ━━━

function fitCircle(border: Point[]) {
  let cx = 0, cy = 0
  for (const p of border) { cx += p.x; cy += p.y }
  cx /= border.length; cy /= border.length
  let sumR = 0; const dists: number[] = []
  for (const p of border) { const d = Math.hypot(p.x - cx, p.y - cy); dists.push(d); sumR += d }
  const r = sumR / border.length
  let v = 0; for (const d of dists) v += (d - r) ** 2
  return { cx, cy, r, circularity: 1 - Math.sqrt(v / dists.length) / r }
}

function fitEllipse(border: Point[]) {
  let cx = 0, cy = 0
  for (const p of border) { cx += p.x; cy += p.y }
  cx /= border.length; cy /= border.length
  let maxDx = 0, maxDy = 0
  for (const p of border) { maxDx = Math.max(maxDx, Math.abs(p.x - cx)); maxDy = Math.max(maxDy, Math.abs(p.y - cy)) }
  let sumErr = 0
  for (const p of border) {
    const nx = (p.x - cx) / (maxDx || 1), ny = (p.y - cy) / (maxDy || 1)
    sumErr += (Math.sqrt(nx * nx + ny * ny) - 1) ** 2
  }
  return { cx, cy, rx: maxDx, ry: maxDy, circularity: 1 - Math.min(Math.sqrt(sumErr / border.length), 1) }
}

function circleSVG(cx: number, cy: number, r: number): string {
  const k = r * KAPPA
  return `M ${cx} ${cy - r} C ${cx + k} ${cy - r}, ${cx + r} ${cy - k}, ${cx + r} ${cy} C ${cx + r} ${cy + k}, ${cx + k} ${cy + r}, ${cx} ${cy + r} C ${cx - k} ${cy + r}, ${cx - r} ${cy + k}, ${cx - r} ${cy} C ${cx - r} ${cy - k}, ${cx - k} ${cy - r}, ${cx} ${cy - r} Z`
}

function ellipseSVG(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * KAPPA, ky = ry * KAPPA
  return `M ${cx} ${cy - ry} C ${cx + kx} ${cy - ry}, ${cx + rx} ${cy - ky}, ${cx + rx} ${cy} C ${cx + rx} ${cy + ky}, ${cx + kx} ${cy + ry}, ${cx} ${cy + ry} C ${cx - kx} ${cy + ry}, ${cx - rx} ${cy + ky}, ${cx - rx} ${cy} C ${cx - rx} ${cy - ky}, ${cx - kx} ${cy - ry}, ${cx} ${cy - ry} Z`
}

// ━━━ 메인 ━━━

export function extractContour(
  img: HTMLImageElement,
  scale: number,
  offsetMm: number,
  pxPerMm: number,
  sigma = 3,
  slices = 60,
): ContourResult | null {
  const canvas = document.createElement('canvas')
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)

  // 오프셋: scale을 제거하여 올바른 화면 픽셀 단위로 계산
  const offsetPx = offsetMm * pxPerMm

  // 1. 경계 픽셀 추출
  const border = extractBorderPixels(imageData, 20)
  if (border.length < 20) return null

  // 원형/타원 감지
  const circle = fitCircle(border)
  if (circle.circularity > 0.92) {
    const { cx, cy, r } = circle
    return {
      outline: [{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }],
      cutLine: [{ x: cx, y: cy - r - offsetPx }, { x: cx + r + offsetPx, y: cy }, { x: cx, y: cy + r + offsetPx }, { x: cx - r - offsetPx, y: cy }],
      svgOutline: circleSVG(cx, cy, r),
      svgCutLine: circleSVG(cx, cy, r + offsetPx),
    }
  }
  const ell = fitEllipse(border)
  if (ell.circularity > 0.88) {
    const { cx, cy, rx, ry } = ell
    return {
      outline: [{ x: cx, y: cy - ry }, { x: cx + rx, y: cy }, { x: cx, y: cy + ry }, { x: cx - rx, y: cy }],
      cutLine: [{ x: cx, y: cy - ry - offsetPx }, { x: cx + rx + offsetPx, y: cy }, { x: cx, y: cy + ry + offsetPx }, { x: cx - rx - offsetPx, y: cy }],
      svgOutline: ellipseSVG(cx, cy, rx, ry),
      svgCutLine: ellipseSVG(cx, cy, rx + offsetPx, ry + offsetPx),
    }
  }

  // 2. 순서 정렬
  const ordered = orderByNearest(border)

  // 3. Gaussian 1D 전처리 — sigma 값으로 스무딩 강도 조절 (radius = 1~4)
  const gaussRadius = Math.max(1, Math.min(4, Math.round(sigma / 2)))
  const preSmoothed = gaussianSmooth1D(ordered, gaussRadius)

  // 4. Douglas-Peucker (epsilon=1.5)
  const reduced = douglasPeucker(preSmoothed, 1.5)
  if (reduced.length < 4) return null

  // 5. Chaikin 2회
  const smooth = chaikinSmooth(reduced, 2)

  // 6. 균등 리샘플링 — slices 값이 직접 포인트 수를 결정
  const count = Math.min(Math.max(slices, 24), 200)
  const resampled = resampleEvenly(smooth, count)

  // 7. 병렬 오프셋 (Round Join + Intersection)
  const cutLinePoints = offsetParallel(resampled, offsetPx)

  // 8. 베지어 SVG
  return {
    outline: resampled,
    cutLine: cutLinePoints,
    svgOutline: toBezierSVG(resampled, 0.25),
    svgCutLine: toBezierSVG(cutLinePoints, 0.25),
  }
}

export function hasTransparency(img: HTMLImageElement): boolean {
  const c = document.createElement('canvas')
  const ratio = Math.min(100 / img.naturalWidth, 100 / img.naturalHeight)
  c.width = Math.round(img.naturalWidth * ratio)
  c.height = Math.round(img.naturalHeight * ratio)
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  for (let i = 3; i < data.length; i += 4) { if (data[i] < 20) return true }
  return false
}
