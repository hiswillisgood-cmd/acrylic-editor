import { useRef, useEffect, useState } from 'react'
import * as fabric from 'fabric'
import { useEditorStore } from '@/stores/editorStore'
import type { Point } from '@/stores/editorStore'
import { setCanvasRef } from '@/stores/canvasRef'
import { mmToScreenPx } from '@/utils/unitConvert'
import { parseSVGCutLine } from '@/utils/svgParser'
import {
  offsetParallel, resampleEvenly,
  unionPolygons, circleToPolygon, roundedRectToPolygon, ellipseToPolygon,
} from '@/utils/cutlineUtils'

const CANVAS_BG    = '#e5e7eb'
const PRODUCT_BG   = '#ffffff'
const CUT_COLOR    = '#ef4444'
const HOLE_COLOR   = '#9ca3af'

// ─── 태그 유틸 ────────────────────────────────────────────────────────────────

interface Tagged extends fabric.FabricObject { _tag?: string }

function tag(obj: fabric.FabricObject, t: string) { (obj as Tagged)._tag = t }

function removeByTag(canvas: fabric.Canvas, ...tags: string[]) {
  const set = new Set(tags)
  const toRemove = canvas.getObjects().filter(o => set.has((o as Tagged)._tag ?? ''))
  if (toRemove.length) canvas.remove(...toRemove)
}

// ─── 좌표 변환 ────────────────────────────────────────────────────────────────

// SVG 내부 좌표 → 화면 픽셀 (중앙 정렬)
function svgPolyToScreen(
  polygon: Point[],
  bbox: { x: number; y: number; w: number; h: number },
  targetW: number,
  targetH: number,
  cx: number,
  cy: number,
): Point[] {
  if (!bbox.w || !bbox.h) return polygon
  const scale = Math.min(targetW / bbox.w, targetH / bbox.h)
  const dx = cx - (bbox.x + bbox.w / 2) * scale
  const dy = cy - (bbox.y + bbox.h / 2) * scale
  return polygon.map(p => ({ x: p.x * scale + dx, y: p.y * scale + dy }))
}

// 화면 좌표(y down) 기준 폴리곤 부호 면적 — 음수면 시각적 CW, 양수면 CCW
function polygonSignedSum(poly: Point[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    sum += (b.x - a.x) * (b.y + a.y)
  }
  return sum
}

// ─── 스냅 헬퍼 ────────────────────────────────────────────────────────────────

// 폴리곤 위의 가장 가까운 점 + 외향 법선 방향으로 protrude만큼 이동
function snapToPolygon(px: number, py: number, poly: Point[], protrude: number): Point {
  let bestIdx = 0, bestD = Infinity
  for (let i = 0; i < poly.length; i++) {
    const d = (poly[i].x - px) ** 2 + (poly[i].y - py) ** 2
    if (d < bestD) { bestD = d; bestIdx = i }
  }
  const n = poly.length
  const p    = poly[bestIdx]
  const prev = poly[(bestIdx - 1 + n) % n]
  const next = poly[(bestIdx + 1) % n]
  const tx = next.x - prev.x, ty = next.y - prev.y
  const tLen = Math.hypot(tx, ty) || 1
  return { x: p.x + (-ty / tLen) * protrude, y: p.y + (tx / tLen) * protrude }
}

// 둥근 사각형 외곽으로 스냅: 모서리는 호 위에, 변은 수직 방향으로 protrude
// 내부 점일 때는 가까운 변(가로/세로) 중 더 가까운 쪽으로 스냅 — 안쪽 드래그 시 반대편 변으로 점프 방지
function snapToRoundedRect(
  px: number, py: number,
  cx: number, cy: number,
  halfW: number, halfH: number,
  cornerR: number,
  protrude: number,
): Point {
  const localX = px - cx, localY = py - cy
  const sx = Math.sign(localX) || 1
  const sy = Math.sign(localY) || 1
  const ax = Math.abs(localX), ay = Math.abs(localY)
  const innerW = halfW - cornerR
  const innerH = halfH - cornerR

  const toTop  = (): Point => ({ x: cx + sx * Math.min(ax, innerW), y: cy + sy * (halfH + protrude) })
  const toSide = (): Point => ({ x: cx + sx * (halfW + protrude), y: cy + sy * Math.min(ay, innerH) })

  // inner rect 내부: 변까지의 거리 비교
  if (ax <= innerW && ay <= innerH) {
    return (halfH - ay) <= (halfW - ax) ? toTop() : toSide()
  }
  // 상/하 변 연장 영역 (가로 안쪽, 세로는 바깥)
  if (ax <= innerW) return toTop()
  // 좌/우 변 연장 영역
  if (ay <= innerH) return toSide()
  // 모서리 호 영역: 호 중심에서 반지름 방향
  const arcCx = innerW, arcCy = innerH
  const ddx = ax - arcCx, ddy = ay - arcCy
  const d = Math.hypot(ddx, ddy) || 1
  const ex = arcCx + (ddx / d) * (cornerR + protrude)
  const ey = arcCy + (ddy / d) * (cornerR + protrude)
  return { x: cx + sx * ex, y: cy + sy * ey }
}

// 타원 외곽 + protrude 방향으로 스냅
function snapToEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number, protrude: number): Point {
  const angle = Math.atan2(py - cy, px - cx)
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const r = (rx * ry) / Math.sqrt((ry * cosA) ** 2 + (rx * sinA) ** 2)
  return { x: cx + (r + protrude) * cosA, y: cy + (r + protrude) * sinA }
}

// ─── 고리 렌더링 ──────────────────────────────────────────────────────────────

interface HoleOptions {
  canvas: fabric.Canvas
  positions: Point[]
  zoom: number
  snapFn: (x: number, y: number) => Point
  // hole 위치가 바뀔 때마다 호출 — cut-line polygon을 hole circles와 union해서 재구성
  onPositionsChange: (positions: Point[]) => void
}

function renderHoleGroups({ canvas, positions, zoom, snapFn, onPositionsChange }: HoleOptions): fabric.Group[] {
  const outerR = mmToScreenPx(3.5) * zoom
  const innerR = mmToScreenPx(1.5) * zoom
  const groups: fabric.Group[] = []

  // outer ring은 cut-line union 결과에 포함되므로 hole 객체에는 inner 타공점만
  // (드래그 hit area 확보 위해 outer 영역만큼의 invisible 원도 함께 그룹화)
  for (const pos of positions) {
    const hitArea = new fabric.Circle({
      left: 0, top: 0, radius: outerR,
      fill: 'transparent', stroke: 'transparent',
      originX: 'center', originY: 'center',
    })
    // 타공 커팅 라인 — 빨간 ring (실제 drill cut path를 시각화), 안쪽 투명
    const inner = new fabric.Circle({
      left: 0, top: 0, radius: innerR,
      fill: 'transparent', stroke: CUT_COLOR, strokeWidth: 1.5,
      originX: 'center', originY: 'center',
    })
    const group = new fabric.Group([hitArea, inner], {
      left: pos.x, top: pos.y,
      originX: 'center', originY: 'center',
      selectable: true,
      hasControls: false,
      hasBorders: false,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hoverCursor: 'grab',
      moveCursor: 'grabbing',
    })
    tag(group, 'hole')
    groups.push(group)

    const minGap = outerR * 2 + mmToScreenPx(1) * zoom

    group.on('moving', () => {
      // 칼선에 스냅
      const snapped = snapFn(group.left!, group.top!)
      let fx = snapped.x, fy = snapped.y

      // 다른 고리와 최소 간격 유지
      for (const other of groups) {
        if (other === group) continue
        const dist = Math.hypot(fx - other.left!, fy - other.top!)
        if (dist < minGap && dist > 0) {
          const ddx = fx - other.left!, ddy = fy - other.top!
          const d = Math.hypot(ddx, ddy) || 1
          const pushed = snapFn(other.left! + (ddx / d) * minGap, other.top! + (ddy / d) * minGap)
          fx = pushed.x; fy = pushed.y
        }
      }
      group.set({ left: fx, top: fy })
      // drag 중 cut-line polygon을 hole circles와 union해서 재구성 (한 path)
      onPositionsChange(groups.map((g) => ({ x: g.left ?? 0, y: g.top ?? 0 })))
      canvas.renderAll()
    })

    canvas.add(group)
  }

  // 초기 배치 후에도 union 적용
  onPositionsChange(groups.map((g) => ({ x: g.left ?? 0, y: g.top ?? 0 })))

  return groups
}

// ─── 레이어 순서 정리 ─────────────────────────────────────────────────────────

// z-order: 아래 → 위. hole이 cut-line 위에 있어야 hole의 흰 fill이
// cut-line stroke를 가려서 "고리 외곽 + 칼선" 한 외곽선 모양이 됨.
// cut-line은 evented:false라 마우스 이벤트는 그대로 hole로 전달됨.
const Z_ORDER = ['product-area', 'user-image', 'cut-line', 'hole'] as const

function reorder(canvas: fabric.Canvas) {
  for (const tag of Z_ORDER) {
    for (const o of canvas.getObjects()) {
      if ((o as Tagged)._tag === tag) canvas.bringObjectToFront(o)
    }
  }
  for (const o of canvas.getObjects()) {
    if ((o as Tagged)._tag === 'cut-line') {
      o.set({ evented: false, selectable: false })
    }
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function FabricCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fabricRef    = useRef<fabric.Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const parsedSvgRef = useRef<ReturnType<typeof parseSVGCutLine>>(null)

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  const width          = useEditorStore(s => s.width)
  const height         = useEditorStore(s => s.height)
  const cornerRadius   = useEditorStore(s => s.cornerRadius)
  const cutLineOffset  = useEditorStore(s => s.cutLineOffset)
  const zoom           = useEditorStore(s => s.zoom)
  const holeCount      = useEditorStore(s => s.holeCount)
  const holePosition   = useEditorStore(s => s.holePosition)
  const productType    = useEditorStore(s => s.productType)
  const cutShape       = useEditorStore(s => s.cutShape)
  const cutLineSvgData = useEditorStore(s => s.cutLineSvgData)
  const setCutLinePolygon = useEditorStore(s => s.setCutLinePolygon)
  const activeSide     = useEditorStore(s => s.activeSide)
  const frontImages    = useEditorStore(s => s.frontImages)
  const backImages     = useEditorStore(s => s.backImages)
  const corolotMode    = useEditorStore(s => s.corolotMode)
  const selectedImageId = useEditorStore(s => s.selectedImageId)

  // ── 캔버스 초기화 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return
    const container = containerRef.current
    const initW = container?.clientWidth ?? 0
    const initH = container?.clientHeight ?? 0

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: Math.max(initW, 1), height: Math.max(initH, 1),
      backgroundColor: CANVAS_BG,
      selection: false,
      preserveObjectStacking: true,
    })
    if (initW > 0 && initH > 0) setCanvasSize({ w: initW, h: initH })
    fabricRef.current = canvas
    setCanvasRef(canvas)

    canvas.on('mouse:wheel', (opt) => {
      opt.e.preventDefault()
      opt.e.stopPropagation()
      const curr = useEditorStore.getState().zoom
      const delta = opt.e.deltaY > 0 ? -0.05 : 0.05
      useEditorStore.getState().setZoom(Math.min(3, Math.max(0.3, curr + delta)))
    })

    return () => { canvas.dispose(); fabricRef.current = null; setCanvasRef(null) }
  }, [])

  // ── 컨테이너 리사이즈 ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const resize = () => {
      const { width: w, height: h } = container.getBoundingClientRect()
      if (w > 0 && h > 0) { canvas.setDimensions({ width: w, height: h }); setCanvasSize({ w, h }) }
    }
    resize()
    const obs = new ResizeObserver(resize)
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  // ── SVG 파싱 캐시 (cutLineSvgData 바뀔 때만 재파싱) ─────────────────────────
  useEffect(() => {
    if (!cutLineSvgData) { parsedSvgRef.current = null; return }
    parsedSvgRef.current = parseSVGCutLine(cutLineSvgData)
  }, [cutLineSvgData])

  // ── 제품 영역 + 칼선 + 고리 렌더링 ──────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (canvasSize.w <= 0 || canvasSize.h <= 0) return

    removeByTag(canvas, 'product-area', 'cut-line', 'hole')
    setCutLinePolygon(null)

    const cx  = canvasSize.w / 2
    const cy  = canvasSize.h / 2
    const pW  = mmToScreenPx(width) * zoom
    const pH  = mmToScreenPx(height) * zoom
    const off = mmToScreenPx(cutLineOffset) * zoom
    const rad = mmToScreenPx(cornerRadius) * zoom

    const needHoles = holeCount > 0 && (productType === 'keyring' || productType === 'corolot')

    // ── 1. cut-line의 base polygon 및 product 영역 polygon 계산 ────────────────
    let productAreaPoly: Point[] | null = null
    let cutLineBase: Point[] | null = null

    let snapFn: (x: number, y: number) => Point = (x, y) => ({ x, y })
    let positions: Point[] = []
    const protrude = mmToScreenPx(3.5) * zoom * 0.4

    if (cutShape === 'rectangle') {
      productAreaPoly = roundedRectToPolygon(cx, cy, pW / 2, pH / 2, rad, 12)
      const clW = pW + off * 2, clH = pH + off * 2
      const halfW = clW / 2, halfH = clH / 2
      cutLineBase = roundedRectToPolygon(cx, cy, halfW, halfH, rad + off, 12)
      if (needHoles) {
        snapFn = (px, py) => snapToRoundedRect(px, py, cx, cy, halfW, halfH, rad + off, protrude)
        positions = holePositions(cx, cy, halfW, halfH, holeCount, holePosition, protrude, rad + off)
      }
    } else if (cutShape === 'circle') {
      const rx = pW / 2, ry = pH / 2
      const crx = rx + off, cry = ry + off
      if (needHoles) {
        // hole 있을 때만 union 위해 polygon (segments 128로 매끄럽게)
        productAreaPoly = ellipseToPolygon(cx, cy, rx, ry, 128)
        cutLineBase = ellipseToPolygon(cx, cy, crx, cry, 128)
        snapFn = (px, py) => snapToEllipse(px, py, cx, cy, crx, cry, protrude)
        positions = ellipseHolePositions(cx, cy, crx, cry, holeCount, holePosition, protrude)
      } else {
        // hole 없으면 native ellipse(4 anchor bezier)로 그려 진짜 매끄러운 곡선
        const bgEl = new fabric.Ellipse({
          left: cx - rx, top: cy - ry, rx, ry,
          fill: PRODUCT_BG, selectable: false, evented: false,
          shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 16, offsetX: 0, offsetY: 4 }),
        })
        tag(bgEl, 'product-area')
        canvas.add(bgEl)
        const clEl = new fabric.Ellipse({
          left: cx - crx, top: cy - cry, rx: crx, ry: cry,
          fill: 'transparent', stroke: CUT_COLOR, strokeWidth: 1.5,
          selectable: false, evented: false,
        })
        tag(clEl, 'cut-line')
        canvas.add(clEl)
        reorder(canvas)
        canvas.renderAll()
        return
      }
    } else {
      // 자유형
      if (!cutLineSvgData || !parsedSvgRef.current) {
        canvas.renderAll()
        return
      }
      const parsed = parsedSvgRef.current
      let screenPoly = svgPolyToScreen(parsed.polygon, parsed.bbox, pW, pH, cx, cy)
      if (polygonSignedSum(screenPoly) < 0) screenPoly = screenPoly.slice().reverse()
      productAreaPoly = screenPoly
      cutLineBase = offsetParallel(screenPoly, off)
      if (needHoles) {
        const sampled = resampleEvenly(cutLineBase, 300)
        setCutLinePolygon(sampled)
        snapFn = (px, py) => snapToPolygon(px, py, sampled, protrude)
        positions = freeformHolePositions(sampled, holeCount, protrude)
      }
    }

    if (!productAreaPoly || !cutLineBase) {
      canvas.renderAll()
      return
    }

    // ── 2. product 영역 (polygon) ───────────────────────────────────────────────
    const bg = new fabric.Polygon(productAreaPoly, {
      fill: PRODUCT_BG, selectable: false, evented: false,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 16, offsetX: 0, offsetY: 4 }),
    })
    tag(bg, 'product-area')
    canvas.add(bg)

    // ── 3. cut-line — hole circles와 union해서 단일 polygon ──────────────────
    const holeOuterR = mmToScreenPx(3.5) * zoom
    const buildMergedCutLine = (holeCenters: Point[]): Point[] => {
      if (!cutLineBase || holeCenters.length === 0) return cutLineBase ?? []
      const holePolys = holeCenters.map((p) => circleToPolygon(p.x, p.y, holeOuterR, 48))
      const merged = unionPolygons([cutLineBase, ...holePolys])
      return merged.length >= 3 ? merged : cutLineBase
    }
    const cl = new fabric.Polygon(buildMergedCutLine(positions), {
      fill: 'transparent', stroke: CUT_COLOR, strokeWidth: 1.5,
      selectable: false, evented: false,
      objectCaching: false,  // points 변경 시 즉시 재렌더
    })
    tag(cl, 'cut-line')
    canvas.add(cl)

    // ── 4. 고리 (drag 시 cut-line polygon 재계산) ───────────────────────────────
    if (needHoles && positions.length > 0) {
      renderHoleGroups({
        canvas, positions, zoom, snapFn,
        onPositionsChange: (newCenters) => {
          const merged = buildMergedCutLine(newCenters)
          cl.set({ points: merged })
          cl.setCoords()
        },
      })
    }

    reorder(canvas)
    canvas.renderAll()
  }, [
    width, height, cornerRadius, cutLineOffset, zoom,
    holeCount, holePosition, productType, cutShape, cutLineSvgData, canvasSize,
  ])

  // ── 다중 이미지 배치 (incremental sync) ──────────────────────────────────────
  const imagesMapRef = useRef<Map<string, fabric.FabricImage>>(new Map())
  const loadingIdsRef = useRef<Set<string>>(new Set())

  // 현재 표시 대상 이미지 배열 (corolot 양면 처리)
  const activeImages = (() => {
    if (productType === 'corolot' && corolotMode === 'different-image') {
      return activeSide === 'back' ? backImages : frontImages
    }
    return frontImages
  })()

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (canvasSize.w <= 0 || canvasSize.h <= 0) return

    const cx = canvasSize.w / 2
    const cy = canvasSize.h / 2
    const map = imagesMapRef.current
    const newIds = new Set(activeImages.map((i) => i.id))

    // 제거된 이미지
    for (const [id, obj] of Array.from(map.entries())) {
      if (!newIds.has(id)) {
        canvas.remove(obj)
        map.delete(id)
      }
    }

    // 추가 / 업데이트
    for (const img of activeImages) {
      const existing = map.get(img.id)
      if (existing) {
        existing.set({
          left: cx + img.x,
          top: cy + img.y,
          scaleX: img.scaleX,
          scaleY: img.scaleY,
          angle: img.angle,
          visible: img.visible,
        })
      } else {
        // 비동기 로딩 중인 id는 건너뜀 (race condition으로 중복 추가 방지)
        if (loadingIdsRef.current.has(img.id)) continue
        loadingIdsRef.current.add(img.id)
        // 비동기 로드. 초기 scaleX/scaleY가 1이면 캔버스에 맞춰 자동 fit
        const el = new Image()
        const targetImg = img
        el.onload = () => {
          loadingIdsRef.current.delete(targetImg.id)
          // 로드 완료 시점에 이미 store에서 제거됐다면 추가 안 함
          const st = useEditorStore.getState()
          const sideKey = (st.productType === 'corolot' && st.corolotMode === 'different-image' && activeSide === 'back') ? 'backImages' : 'frontImages'
          if (!st[sideKey].some((i) => i.id === targetImg.id)) return
          // 이미 map에 있으면 중복 추가 방지
          if (map.has(targetImg.id)) return
          // 첫 추가 시 product 영역에 맞도록 자동 scale (스토어의 1,1을 화면 scale로 환산)
          const pW = mmToScreenPx(width) * zoom
          const pH = mmToScreenPx(height) * zoom
          const autoFit = Math.min(pW / el.width, pH / el.height) * 0.9
          const sX = targetImg.scaleX === 1 && targetImg.x === 0 && targetImg.y === 0 ? autoFit : targetImg.scaleX
          const sY = targetImg.scaleY === 1 && targetImg.x === 0 && targetImg.y === 0 ? autoFit : targetImg.scaleY
          const fImg = new fabric.FabricImage(el, {
            left: cx + targetImg.x,
            top:  cy + targetImg.y,
            scaleX: sX,
            scaleY: sY,
            angle: targetImg.angle,
            originX: 'center',
            originY: 'center',
            centeredScaling: true,
            centeredRotation: true,
            selectable: true,
            visible: targetImg.visible,
          })
          tag(fImg, 'user-image')
          ;(fImg as Tagged & { _imageId?: string })._imageId = targetImg.id
          map.set(targetImg.id, fImg)
          canvas.add(fImg)
          // 초기 자동 fit이 적용되었으면 store에도 반영
          if (sX !== targetImg.scaleX) {
            useEditorStore.getState().updateImage(activeSide, targetImg.id, { scaleX: sX, scaleY: sY })
          }
          reorder(canvas)
          canvas.renderAll()
        }
        el.src = img.dataUrl
      }
    }

    // 같은 면의 이미지들 z-order를 store 배열 순서대로 정렬 (마지막 = 가장 위)
    for (const img of activeImages) {
      const obj = map.get(img.id)
      if (obj) canvas.bringObjectToFront(obj)
    }
    reorder(canvas) // 칼선이 다시 최상위로
    canvas.renderAll()
  }, [activeImages, productType, corolotMode, activeSide, canvasSize, width, height, zoom])

  // ── Fabric → store sync (drag/scale/rotate, selection) ───────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleModified = (e: { target?: fabric.FabricObject }) => {
      const obj = e.target as (fabric.FabricObject & { _tag?: string; _imageId?: string }) | undefined
      if (!obj || obj._tag !== 'user-image' || !obj._imageId) return
      const cx = canvasSize.w / 2
      const cy = canvasSize.h / 2
      useEditorStore.getState().updateImage(activeSide, obj._imageId, {
        x: (obj.left ?? 0) - cx,
        y: (obj.top  ?? 0) - cy,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        angle:  obj.angle  ?? 0,
      })
    }
    const handleSelected = (e: { selected?: fabric.FabricObject[] }) => {
      const obj = e.selected?.[0] as (fabric.FabricObject & { _imageId?: string }) | undefined
      if (obj?._imageId) useEditorStore.getState().setSelectedImageId(obj._imageId)
    }
    const handleCleared = () => useEditorStore.getState().setSelectedImageId(null)

    canvas.on('object:modified', handleModified)
    canvas.on('selection:created', handleSelected)
    canvas.on('selection:updated', handleSelected)
    canvas.on('selection:cleared', handleCleared)
    return () => {
      canvas.off('object:modified', handleModified)
      canvas.off('selection:created', handleSelected)
      canvas.off('selection:updated', handleSelected)
      canvas.off('selection:cleared', handleCleared)
    }
  }, [activeSide, canvasSize])

  // ── 사이드바에서 선택 변경 시 canvas active object 동기화 ────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (!selectedImageId) {
      canvas.discardActiveObject()
      canvas.renderAll()
      return
    }
    const obj = imagesMapRef.current.get(selectedImageId)
    if (obj && canvas.getActiveObject() !== obj) {
      canvas.setActiveObject(obj)
      canvas.renderAll()
    }
  }, [selectedImageId])

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

// ─── 고리 초기 위치 계산 ─────────────────────────────────────────────────────

function holePositions(
  cx: number, cy: number,
  halfW: number, halfH: number,
  count: number, position: string, protrude: number,
  cornerR: number = 0,
): Point[] {
  // 평면 변 영역 절반(코너 호 제외) — 2개 고리 spacing은 이 안에서
  const flatHalfH = Math.max(halfH - cornerR, 0)
  const flatHalfW = Math.max(halfW - cornerR, 0)
  const spaceH = flatHalfW * 0.5  // top/bottom일 때
  const spaceV = flatHalfH * 0.5  // left/right일 때
  const pts: Point[] = []
  if (count === 1) {
    if (position === 'top')    pts.push({ x: cx,                    y: cy - halfH - protrude })
    if (position === 'bottom') pts.push({ x: cx,                    y: cy + halfH + protrude })
    if (position === 'left')   pts.push({ x: cx - halfW - protrude, y: cy })
    if (position === 'right')  pts.push({ x: cx + halfW + protrude, y: cy })
  } else if (count === 2) {
    if (position === 'top') {
      pts.push({ x: cx - spaceH, y: cy - halfH - protrude })
      pts.push({ x: cx + spaceH, y: cy - halfH - protrude })
    } else if (position === 'bottom') {
      pts.push({ x: cx - spaceH, y: cy + halfH + protrude })
      pts.push({ x: cx + spaceH, y: cy + halfH + protrude })
    } else if (position === 'left') {
      pts.push({ x: cx - halfW - protrude, y: cy - spaceV })
      pts.push({ x: cx - halfW - protrude, y: cy + spaceV })
    } else if (position === 'right') {
      pts.push({ x: cx + halfW + protrude, y: cy - spaceV })
      pts.push({ x: cx + halfW + protrude, y: cy + spaceV })
    }
  }
  return pts
}

// 타원: 각도 기반 고리 초기 위치 (직사각형 로직으로는 타원 경계를 벗어남)
function ellipseHolePositions(
  cx: number, cy: number,
  rx: number, ry: number,
  count: number, position: string, protrude: number,
): Point[] {
  const centerAngle: Record<string, number> = {
    top:    -Math.PI / 2,
    bottom:  Math.PI / 2,
    left:    Math.PI,
    right:   0,
  }
  const base = centerAngle[position] ?? -Math.PI / 2
  const angles = count === 1 ? [base] : [base - Math.PI / 6, base + Math.PI / 6]
  return angles.map(a => {
    const cosA = Math.cos(a), sinA = Math.sin(a)
    const r = (rx * ry) / Math.sqrt((ry * cosA) ** 2 + (rx * sinA) ** 2)
    return { x: cx + (r + protrude) * cosA, y: cy + (r + protrude) * sinA }
  })
}

// 자유형: 칼선 폴리곤 위에 균등 간격으로 고리 배치
function freeformHolePositions(poly: Point[], count: number, protrude: number): Point[] {
  if (!poly.length || count === 0) return []
  const step = Math.floor(poly.length / (count + 1))
  return Array.from({ length: count }, (_, i) => {
    const n = poly.length
    const idx = step * (i + 1)
    const p    = poly[idx % n]
    const prev = poly[(idx - 1 + n) % n]
    const next = poly[(idx + 1) % n]
    const tx = next.x - prev.x, ty = next.y - prev.y
    const tLen = Math.hypot(tx, ty) || 1
    return { x: p.x + (-ty / tLen) * protrude, y: p.y + (tx / tLen) * protrude }
  })
}
