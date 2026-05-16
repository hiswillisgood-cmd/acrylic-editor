export interface Point { x: number; y: number }

export interface ParsedCutLine {
  polygon: Point[]
  bbox: { x: number; y: number; w: number; h: number }
  mmSize: { w: number; h: number } | null
}

function parseMmValue(val: string | null): number | null {
  if (!val) return null
  const m = val.trim().match(/^([\d.]+)\s*(mm|cm|in|pt|pc|px)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  switch (m[2] ?? 'px') {
    case 'mm': return n
    case 'cm': return n * 10
    case 'in': return n * 25.4
    case 'pt': return n * (25.4 / 72)
    case 'pc': return n * (25.4 / 6)
    default:   return n * (25.4 / 96) // px → mm @ 96dpi
  }
}

export function parseSVGCutLine(svgString: string, numSamples = 200): ParsedCutLine | null {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null

  const svgEl = doc.querySelector('svg')
  if (!svgEl) return null

  const mmW = parseMmValue(svgEl.getAttribute('width'))
  const mmH = parseMmValue(svgEl.getAttribute('height'))
  const mmSize = (mmW && mmH && mmW > 0 && mmH > 0) ? { w: mmW, h: mmH } : null

  // 임시 SVG를 DOM에 붙여 getBBox / getPointAtLength 사용
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  tempSvg.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:visible'

  const vb = svgEl.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (vb && vb.length === 4) tempSvg.setAttribute('viewBox', vb.join(' '))

  document.body.appendChild(tempSvg)

  try {
    const shapes = Array.from(svgEl.querySelectorAll('path,rect,circle,ellipse,polygon,polyline'))
    if (!shapes.length) return null

    let bestEl: SVGGeometryElement | null = null
    let bestArea = 0

    for (const shape of shapes) {
      const clone = document.importNode(shape, true) as SVGGeometryElement
      tempSvg.appendChild(clone)
      try {
        const { width, height } = clone.getBBox()
        const area = width * height
        if (area > bestArea) {
          bestArea = area
          if (bestEl) tempSvg.removeChild(bestEl)
          bestEl = clone
        } else {
          tempSvg.removeChild(clone)
        }
      } catch {
        try { tempSvg.removeChild(clone) } catch { /* ignore */ }
      }
    }

    if (!bestEl) return null

    let polygon: Point[]

    if (bestEl instanceof SVGPolygonElement || bestEl instanceof SVGPolylineElement) {
      polygon = Array.from(bestEl.points).map(p => ({ x: p.x, y: p.y }))
    } else {
      const geom = bestEl as SVGGeometryElement
      const totalLen = geom.getTotalLength()
      if (totalLen < 1) return null
      polygon = []
      for (let i = 0; i < numSamples; i++) {
        const pt = geom.getPointAtLength((i / numSamples) * totalLen)
        polygon.push({ x: pt.x, y: pt.y })
      }
    }

    if (polygon.length < 3) return null

    const { x, y, width, height } = bestEl.getBBox()
    return { polygon, bbox: { x, y, w: width, h: height }, mmSize }
  } finally {
    document.body.removeChild(tempSvg)
  }
}
