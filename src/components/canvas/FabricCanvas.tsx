import { useRef, useEffect, useState } from 'react'
import * as fabric from 'fabric'
import { useEditorStore } from '@/stores/editorStore'
import { setCanvasRef } from '@/stores/canvasRef'
import { mmToScreenPx } from '@/utils/unitConvert'
import { extractContour, hasTransparency } from '@/utils/contourTrace'

const CANVAS_BG = '#e5e7eb'
const PRODUCT_BG = '#ffffff'
const CUT_LINE_COLOR = '#ef4444'
const HOLE_COLOR = '#9ca3af'

interface TaggedObject extends fabric.FabricObject {
  _editorType?: string
}

function removeByType(canvas: fabric.Canvas, ...types: string[]) {
  const toRemove = canvas.getObjects().filter(
    (o) => types.includes((o as TaggedObject)._editorType ?? '')
  )
  toRemove.forEach((o) => canvas.remove(o))
}

function tagObject(obj: fabric.FabricObject, type: string) {
  (obj as TaggedObject)._editorType = type
}

export default function FabricCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 500 })

  const width = useEditorStore((s) => s.width)
  const height = useEditorStore((s) => s.height)
  const cornerRadius = useEditorStore((s) => s.cornerRadius)
  const cutLineOffset = useEditorStore((s) => s.cutLineOffset)
  const zoom = useEditorStore((s) => s.zoom)
  const holeCount = useEditorStore((s) => s.holeCount)
  const holePosition = useEditorStore((s) => s.holePosition)
  const frontImageData = useEditorStore((s) => s.frontImageData)
  const productType = useEditorStore((s) => s.productType)
  const cutShape = useEditorStore((s) => s.cutShape)
  const contourSigma = useEditorStore((s) => s.contourSigma)
  const contourSlices = useEditorStore((s) => s.contourSlices)
  const contourOffset = useEditorStore((s) => s.contourOffset)

  // Initialize canvas (once)
  useEffect(() => {
    if (!canvasRef.current) return

    const container = containerRef.current
    const initW = container ? container.clientWidth : 400
    const initH = container ? container.clientHeight : 400
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: initW,
      height: initH,
      backgroundColor: CANVAS_BG,
      selection: true,
      preserveObjectStacking: true, // z-order 유지, 선택해도 순서 안 바뀜
    })
    setCanvasSize({ w: initW, h: initH })
    fabricRef.current = canvas
    setCanvasRef(canvas)

    // 고리 우선 선택: 클릭 위치 근처에 고리가 있으면 강제 선택
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getViewportPoint(opt.e)
      const holeObjs = canvas.getObjects().filter(
        o => (o as TaggedObject)._editorType === 'hole'
      )
      for (const hole of holeObjs) {
        const dist = Math.hypot(pointer.x - hole.left!, pointer.y - hole.top!)
        if (dist < 25) { // 고리 반경 내 클릭
          canvas.setActiveObject(hole)
          canvas.renderAll()
          return
        }
      }
    })

    // Zoom with mouse wheel
    canvas.on('mouse:wheel', (opt: fabric.TEvent<WheelEvent>) => {
      const e = opt.e
      e.preventDefault()
      e.stopPropagation()
      const currentZoom = useEditorStore.getState().zoom
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      useEditorStore.getState().setZoom(Math.min(3, Math.max(0.3, currentZoom + delta)))
    })

    return () => {
      canvas.dispose()
      fabricRef.current = null
      setCanvasRef(null)
    }
  }, [])

  // Resize canvas to fit container
  useEffect(() => {
    const canvas = fabricRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        canvas.setDimensions({ width: rect.width, height: rect.height })
        setCanvasSize({ w: rect.width, h: rect.height })
      }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Draw product area + cut line (redraws on any option or canvas size change)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    removeByType(canvas, 'product-area', 'cut-line', 'hole')

    const productW = mmToScreenPx(width)
    const productH = mmToScreenPx(height)
    const cutOffset = mmToScreenPx(cutLineOffset)
    const radiusPx = mmToScreenPx(cornerRadius)

    const cx = canvasSize.w / 2
    const cy = canvasSize.h / 2

    const pW = productW * zoom
    const pH = productH * zoom

    if (cutShape === 'rectangle') {
      // ── 사각형 모드: 사각 라운드 칼선 ──
      const productRect = new fabric.Rect({
        left: cx - pW / 2, top: cy - pH / 2, width: pW, height: pH,
        fill: PRODUCT_BG, rx: radiusPx * zoom, ry: radiusPx * zoom,
        selectable: false, evented: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 16, offsetX: 0, offsetY: 4 }),
      })
      tagObject(productRect, 'product-area')
      canvas.add(productRect)
      canvas.sendObjectToBack(productRect)

      const clW = (productW + cutOffset * 2) * zoom
      const clH = (productH + cutOffset * 2) * zoom
      const cutLine = new fabric.Rect({
        left: cx - clW / 2, top: cy - clH / 2, width: clW, height: clH,
        fill: 'transparent', stroke: CUT_LINE_COLOR, strokeWidth: 1.5,
        rx: (radiusPx + cutOffset) * zoom, ry: (radiusPx + cutOffset) * zoom,
        selectable: false, evented: false,
      })
      tagObject(cutLine, 'cut-line')
      canvas.add(cutLine)
      canvas.sendObjectToBack(cutLine)
      canvas.bringObjectForward(productRect)

    } else if (cutShape === 'circle') {
      // ── 원형 모드: 타원 칼선 ──
      const rx = pW / 2
      const ry = pH / 2

      // 제품 영역 (타원)
      const productEllipse = new fabric.Ellipse({
        left: cx - rx, top: cy - ry, rx, ry,
        fill: PRODUCT_BG, selectable: false, evented: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 16, offsetX: 0, offsetY: 4 }),
      })
      tagObject(productEllipse, 'product-area')
      canvas.add(productEllipse)
      canvas.sendObjectToBack(productEllipse)

      // 칼선 (타원 + 오프셋)
      const crx = rx + cutOffset * zoom
      const cry = ry + cutOffset * zoom
      const cutEllipse = new fabric.Ellipse({
        left: cx - crx, top: cy - cry, rx: crx, ry: cry,
        fill: 'transparent', stroke: CUT_LINE_COLOR, strokeWidth: 1.5,
        selectable: false, evented: false,
      })
      tagObject(cutEllipse, 'cut-line')
      canvas.add(cutEllipse)
      canvas.sendObjectToBack(cutEllipse)
      canvas.bringObjectForward(productEllipse)

    } else {
      // ── 자유형 모드: 칼선 없음 (이미지 로드 시 자동 생성) ──
      // 제품 영역만 표시 (사각 배경)
      const productRect = new fabric.Rect({
        left: cx - pW / 2, top: cy - pH / 2, width: pW, height: pH,
        fill: PRODUCT_BG, selectable: false, evented: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.12)', blur: 16, offsetX: 0, offsetY: 4 }),
      })
      tagObject(productRect, 'product-area')
      canvas.add(productRect)
      canvas.sendObjectToBack(productRect)
    }

    // ── 고리 (Ring tabs) ──
    if (holeCount > 0 && (productType === 'keyring' || productType === 'corolot')) {
      const tabOuterR = mmToScreenPx(3.5) * zoom
      const tabInnerR = mmToScreenPx(1.5) * zoom
      // 칼선 외곽 기준
      const halfW = cutShape === 'circle'
        ? (pW / 2 + cutOffset * zoom)
        : ((productW + cutOffset * 2) * zoom) / 2
      const halfH = cutShape === 'circle'
        ? (pH / 2 + cutOffset * zoom)
        : ((productH + cutOffset * 2) * zoom) / 2
      const protrude = tabOuterR * 0.4

      // 고리 초기 위치 (사각/원형: 계산, 자유형: snapToEdge 사용)
      const initPos = (targetX: number, targetY: number) => {
        // 자유형은 칼선 포인트가 있으면 그 위에 스냅
        if (cutShape === 'freeform') {
          const pts = useEditorStore.getState().freeformCutLinePoints
          if (pts && pts.length > 2) {
            let bestIdx = 0, bestD = Infinity
            for (let i = 0; i < pts.length; i++) {
              const d = (pts[i].x - targetX) ** 2 + (pts[i].y - targetY) ** 2
              if (d < bestD) { bestD = d; bestIdx = i }
            }
            const p = pts[bestIdx]
            const prev = pts[(bestIdx - 1 + pts.length) % pts.length]
            const next = pts[(bestIdx + 1) % pts.length]
            const tx = next.x - prev.x, ty = next.y - prev.y
            const tLen = Math.hypot(tx, ty) || 1
            return { x: p.x + (-ty / tLen) * protrude, y: p.y + (tx / tLen) * protrude }
          }
        }
        return { x: targetX, y: targetY }
      }

      const positions: { x: number; y: number }[] = []
      if (holeCount === 1) {
        if (holePosition === 'top')    positions.push(initPos(cx, cy - halfH - protrude))
        if (holePosition === 'bottom') positions.push(initPos(cx, cy + halfH + protrude))
        if (holePosition === 'left')   positions.push(initPos(cx - halfW - protrude, cy))
        if (holePosition === 'right')  positions.push(initPos(cx + halfW + protrude, cy))
      } else if (holeCount === 2) {
        const spacing = (productW * zoom) * 0.3
        if (holePosition === 'top') {
          positions.push(initPos(cx - spacing, cy - halfH - protrude))
          positions.push(initPos(cx + spacing, cy - halfH - protrude))
        }
        if (holePosition === 'bottom') {
          positions.push(initPos(cx - spacing, cy + halfH + protrude))
          positions.push(initPos(cx + spacing, cy + halfH + protrude))
        }
        if (holePosition === 'left') {
          positions.push(initPos(cx - halfW - protrude, cy - spacing))
          positions.push(initPos(cx - halfW - protrude, cy + spacing))
        }
        if (holePosition === 'right') {
          positions.push(initPos(cx + halfW + protrude, cy - spacing))
          positions.push(initPos(cx + halfW + protrude, cy + spacing))
        }
      }

      // 칼선 외곽에 스냅하는 함수 (cutShape에 따라 분기)
      const snapToEdge = (dragX: number, dragY: number) => {
        if (cutShape === 'freeform') {
          // 자유형: 저장된 칼선 포인트 중 가장 가까운 점 + 법선 방향 protrude
          const pts = useEditorStore.getState().freeformCutLinePoints
          if (pts && pts.length > 2) {
            let bestIdx = 0, bestD = Infinity
            for (let i = 0; i < pts.length; i++) {
              const d = (pts[i].x - dragX) ** 2 + (pts[i].y - dragY) ** 2
              if (d < bestD) { bestD = d; bestIdx = i }
            }
            const p = pts[bestIdx]
            const prev = pts[(bestIdx - 1 + pts.length) % pts.length]
            const next = pts[(bestIdx + 1) % pts.length]
            // 법선 방향
            const tx = next.x - prev.x, ty = next.y - prev.y
            const tLen = Math.hypot(tx, ty) || 1
            const nx = -ty / tLen, ny = tx / tLen
            return { x: p.x + nx * protrude, y: p.y + ny * protrude }
          }
        }

        const dx = dragX - cx, dy = dragY - cy
        const angle = Math.atan2(dy, dx)
        const cosA = Math.cos(angle), sinA = Math.sin(angle)

        if (cutShape === 'circle') {
          const r = (halfW * halfH) / Math.sqrt((halfH * cosA) ** 2 + (halfW * sinA) ** 2)
          return { x: cx + (r + protrude) * cosA, y: cy + (r + protrude) * sinA }
        } else {
          const tX = cosA !== 0 ? halfW / Math.abs(cosA) : Infinity
          const tY = sinA !== 0 ? halfH / Math.abs(sinA) : Infinity
          const t = Math.min(tX, tY)
          return { x: cx + t * cosA + protrude * cosA, y: cy + t * sinA + protrude * sinA }
        }
      }

      // 각 고리 렌더링 (드래그 가능한 그룹)
      const minGap = mmToScreenPx(1) * zoom  // 최소 1mm 간격
      const holeGroups: fabric.Group[] = []

      for (const pos of positions) {
        const tabOuter = new fabric.Circle({
          left: 0, top: 0, radius: tabOuterR,
          fill: PRODUCT_BG, stroke: CUT_LINE_COLOR, strokeWidth: 1.5,
          originX: 'center', originY: 'center',
        })
        const tabInner = new fabric.Circle({
          left: 0, top: 0, radius: tabInnerR,
          fill: CANVAS_BG, stroke: HOLE_COLOR, strokeWidth: 1.5,
          originX: 'center', originY: 'center',
        })

        const holeGroup = new fabric.Group([tabOuter, tabInner], {
          left: pos.x, top: pos.y,
          originX: 'center', originY: 'center',
          selectable: true, hasControls: false, hasBorders: false,
          lockRotation: true, lockScalingX: true, lockScalingY: true,
          hoverCursor: 'grab', moveCursor: 'grabbing',
          perPixelTargetFind: false, // 전체 bounding box 클릭 가능
        })
        tagObject(holeGroup, 'hole')
        holeGroups.push(holeGroup)

        // 드래그 시 칼선 스냅 + 다른 고리와 최소 1mm 간격 유지
        holeGroup.on('moving', () => {
          const snapped = snapToEdge(holeGroup.left!, holeGroup.top!)
          let finalX = snapped.x, finalY = snapped.y

          // 다른 고리와 거리 체크
          for (const other of holeGroups) {
            if (other === holeGroup) continue
            const dist = Math.hypot(finalX - other.left!, finalY - other.top!)
            const minDist = tabOuterR * 2 + minGap
            if (dist < minDist && dist > 0) {
              // 너무 가까우면 밀어냄
              const dx = finalX - other.left!
              const dy = finalY - other.top!
              const d = Math.hypot(dx, dy) || 1
              finalX = other.left! + (dx / d) * minDist
              finalY = other.top! + (dy / d) * minDist
              // 밀어낸 위치를 다시 칼선에 스냅
              const reSnap = snapToEdge(finalX, finalY)
              finalX = reSnap.x
              finalY = reSnap.y
            }
          }

          holeGroup.set({ left: finalX, top: finalY })
          canvas.renderAll()
        })

        canvas.add(holeGroup)
      }
    }

    canvas.renderAll()
  }, [width, height, cornerRadius, cutLineOffset, zoom, holeCount, holePosition, productType, cutShape, canvasSize])

  // Load front image onto canvas + auto contour for PNG with transparency
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    removeByType(canvas, 'user-image', 'auto-contour')

    if (!frontImageData) {
      canvas.renderAll()
      return
    }

    const productW = mmToScreenPx(width)
    const productH = mmToScreenPx(height)
    const cutOffset = mmToScreenPx(cutLineOffset)

    const imgEl = new Image()
    imgEl.onload = () => {
      // onload 시점에서 다시 한번 이전 칼선 확실히 제거 (비동기 타이밍 문제 방지)
      removeByType(canvas, 'user-image', 'auto-contour')
      const fImg = new fabric.FabricImage(imgEl, {
        selectable: true,
        centeredScaling: true,
        centeredRotation: true,
      })

      const scaleX = (productW * zoom) / imgEl.width
      const scaleY = (productH * zoom) / imgEl.height
      const scale = Math.min(scaleX, scaleY) * 0.9
      fImg.scale(scale)

      const imgLeft = canvasSize.w / 2 - (imgEl.width * scale) / 2
      const imgTop = canvasSize.h / 2 - (imgEl.height * scale) / 2

      fImg.set({ left: imgLeft, top: imgTop })
      tagObject(fImg, 'user-image')

      canvas.add(fImg)
      canvas.discardActiveObject()

      // PNG 투명 영역 감지 → 자동 외곽선 생성
      const hasTrans = hasTransparency(imgEl)
      if (hasTrans) {
        const pxPerMm = mmToScreenPx(1)
        const contourData = extractContour(imgEl, scale, contourOffset, pxPerMm, contourSigma, contourSlices)

        if (contourData) {
          // 원형/타원형 감지 시 Fabric 기본 도형 사용 (좌표 정확)
          const isCircular = contourData.outline.length === 4 &&
            Math.abs(contourData.outline[0].x - contourData.outline[2].x) < 2 &&
            Math.abs(contourData.outline[1].y - contourData.outline[3].y) < 2

          if (isCircular) {
            const pts = contourData.outline
            // 4포인트: top, right, bottom, left → 중심, 반지름 추출
            const ocx = (pts[1].x + pts[3].x) / 2
            const ocy = (pts[0].y + pts[2].y) / 2
            const orx = (pts[1].x - pts[3].x) / 2
            const ory = (pts[2].y - pts[0].y) / 2

            const cpts = contourData.cutLine
            const ccx = (cpts[1].x + cpts[3].x) / 2
            const ccy = (cpts[0].y + cpts[2].y) / 2
            const crx = (cpts[1].x - cpts[3].x) / 2
            const cry = (cpts[2].y - cpts[0].y) / 2

            // 칼선 (빨간 실선)
            const cutEllipse = new fabric.Ellipse({
              left: imgLeft + ccx - crx,
              top: imgTop + ccy - cry,
              rx: crx,
              ry: cry,
              fill: 'transparent',
              stroke: CUT_LINE_COLOR,
              strokeWidth: 1.5,
              selectable: false,
              evented: false,
            })
            tagObject(cutEllipse, 'auto-contour')
            canvas.add(cutEllipse)
          } else {
            // 비정형: 개별 Line으로 렌더링 (좌표 정확, 최상단 보장)
            const drawLines = (pts: { x: number; y: number }[], stroke: string, sw: number) => {
              for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length]
                const line = new fabric.Line(
                  [a.x + imgLeft, a.y + imgTop, b.x + imgLeft, b.y + imgTop],
                  { stroke, strokeWidth: sw, selectable: false, evented: false }
                )
                tagObject(line, 'auto-contour')
                canvas.add(line)
              }
            }

            drawLines(contourData.cutLine, CUT_LINE_COLOR, 1.5)

            // 포인트 수 저장 (개발용 디버그)
            useEditorStore.getState().setContourPointCount({
              outline: contourData.outline.length,
              cutLine: contourData.cutLine.length,
            })

            // 자유형 칼선 포인트를 store에 저장 (고리 스냅용, 절대 좌표)
            const absCutLine = contourData.cutLine.map(p => ({ x: p.x + imgLeft, y: p.y + imgTop }))
            useEditorStore.getState().setFreeformCutLinePoints(absCutLine)

            // 칼선 bounding box → 제품 사이즈 자동 확대
            // cutLine 좌표는 화면 스케일 적용된 이미지 내부 좌표
            // 화면px → mm: px / (mmToScreenPx(1) * zoom)
            let clMinX = Infinity, clMinY = Infinity, clMaxX = -Infinity, clMaxY = -Infinity
            for (const p of contourData.cutLine) {
              if (p.x < clMinX) clMinX = p.x
              if (p.y < clMinY) clMinY = p.y
              if (p.x > clMaxX) clMaxX = p.x
              if (p.y > clMaxY) clMaxY = p.y
            }
            const screenToMm = 1 / (mmToScreenPx(1) * zoom)
            const cutWMm = (clMaxX - clMinX) * screenToMm
            const cutHMm = (clMaxY - clMinY) * screenToMm
            const store = useEditorStore.getState()
            if (cutWMm > store.width || cutHMm > store.height) {
              store.setSize(
                Math.max(store.width, Math.ceil(cutWMm + 1)),
                Math.max(store.height, Math.ceil(cutHMm + 1)),
              )
            }

            // 기존 고리를 칼선 위로 재배치
            const holeObjs = canvas.getObjects().filter(
              o => (o as TaggedObject)._editorType === 'hole'
            )
            if (holeObjs.length > 0 && absCutLine.length > 2) {
              const tabOuterR2 = mmToScreenPx(3.5) * zoom
              const protrude2 = tabOuterR2 * 0.4
              // 고리 수에 따라 균등 분배
              const step = Math.floor(absCutLine.length / (holeObjs.length + 1))
              holeObjs.forEach((hole, idx) => {
                const ptIdx = step * (idx + 1)
                const p = absCutLine[ptIdx % absCutLine.length]
                const prev = absCutLine[(ptIdx - 1 + absCutLine.length) % absCutLine.length]
                const next = absCutLine[(ptIdx + 1) % absCutLine.length]
                const tx = next.x - prev.x, ty = next.y - prev.y
                const tLen = Math.hypot(tx, ty) || 1
                hole.set({
                  left: p.x + (-ty / tLen) * protrude2,
                  top: p.y + (tx / tLen) * protrude2,
                })
              })
            }
          }
        }
      }

      // 레이어 순서 강제 + 고리가 최상단
      for (const o of canvas.getObjects()) {
        const t = (o as TaggedObject)._editorType
        if (t === 'product-area') canvas.sendObjectToBack(o)
      }
      for (const o of canvas.getObjects()) {
        const t = (o as TaggedObject)._editorType
        if (t === 'auto-contour') canvas.bringObjectToFront(o)
      }
      for (const o of canvas.getObjects()) {
        const t = (o as TaggedObject)._editorType
        if (t === 'hole') canvas.bringObjectToFront(o)
      }
      // 칼선 Line이 고리 드래그를 차단하지 않도록
      for (const o of canvas.getObjects()) {
        const t = (o as TaggedObject)._editorType
        if (t === 'auto-contour') {
          o.set({ evented: false, selectable: false, hoverCursor: 'default' })
        }
      }

      canvas.renderAll()
    }
    imgEl.src = frontImageData
  }, [frontImageData, width, height, zoom, canvasSize, cutLineOffset, contourSigma, contourSlices, contourOffset])

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
