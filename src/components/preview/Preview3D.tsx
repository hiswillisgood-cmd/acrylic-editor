import { useMemo, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useEditorStore } from '@/stores/editorStore'
import { getCanvasRef } from '@/stores/canvasRef'
import { PRODUCTS } from '@/config/products'

// ─── 캔버스 px → mm 변환 (제품 중심 원점) ────────────────────────────────────
// cutLine: 본체 외곽 (offset 포함). printArea: 인쇄 영역 (offset만큼 안쪽).

type Pt = { x: number; y: number }

function getPolygonsMm(): { cutLine: Pt[]; printArea: Pt[]; holes: { x: number; y: number; r: number }[] } {
  const canvas = getCanvasRef()
  if (!canvas) return { cutLine: [], printArea: [], holes: [] }
  type Tagged = { _tag?: string }
  const s = useEditorStore.getState()
  const zoom = s.zoom || 1
  const cx = canvas.width  / 2
  const cy = canvas.height / 2
  // mmToScreenPx(1) = 4 * 0.33 = 1.32 → px → mm = px / (1.32 * zoom)
  const pxToMm = (px: number) => (px / 1.32) / zoom

  const cutLine: Pt[] = []
  const printArea: Pt[] = []
  const holes: { x: number; y: number; r: number }[] = []

  type EllipseLike = { rx?: number; ry?: number; left?: number; top?: number; width?: number; height?: number }
  const extractPoly = (o: unknown, target: Pt[]) => {
    const pts = (o as { points?: Pt[] }).points
    if (pts) {
      for (const p of pts) target.push({ x: pxToMm(p.x - cx), y: pxToMm(p.y - cy) })
    } else if ((o as { type?: string }).type === 'ellipse') {
      // 원형(타공 없음)은 fabric.Ellipse로 그려져 .points가 없음 — perimeter sampling
      const e = o as EllipseLike
      const exC = (e.left ?? 0) + (e.width  ?? 0) / 2
      const eyC = (e.top  ?? 0) + (e.height ?? 0) / 2
      const erx = e.rx ?? (e.width  ?? 0) / 2
      const ery = e.ry ?? (e.height ?? 0) / 2
      const segs = 96
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2
        target.push({ x: pxToMm(exC + erx * Math.cos(a) - cx), y: pxToMm(eyC + ery * Math.sin(a) - cy) })
      }
    }
  }

  for (const o of canvas.getObjects()) {
    const tag = (o as unknown as Tagged)._tag
    if (tag === 'cut-line') extractPoly(o, cutLine)
    else if (tag === 'product-area') extractPoly(o, printArea)
    else if (tag === 'hole') {
      holes.push({
        x: pxToMm((o.left ?? 0) - cx),
        y: pxToMm((o.top  ?? 0) - cy),
        r: 1.5, // mm — drill 반지름 (HoleConfigPanel의 inner 3mm 지름)
      })
    }
  }
  return { cutLine, printArea, holes }
}

// ─── 인쇄 텍스처 (양면 각각 product-area bbox 안에서 합성) ─────────────────
// 양면 다른 그림(corolot different-image)을 위해 store의 frontImages/backImages를
// fabric canvas와 무관하게 직접 합성. 단면 케이스는 같은 텍스처 양쪽에 사용.
// front: 본체 뒤에서 정면 카메라로 보일 면 — 좌우 flip해서 acrylic 통과 후 정방향
// back:  본체 뒤에서 후면 카메라로 보일 면 — flip 없이 원본 그대로

function getProductAreaBBox(): { left: number; top: number; width: number; height: number } | null {
  const canvas = getCanvasRef()
  if (!canvas) return null
  type Tagged = { _tag?: string; getBoundingRect?: () => { left: number; top: number; width: number; height: number } }
  const region = canvas.getObjects().find((o) => (o as unknown as Tagged)._tag === 'product-area')
  if (!region || !region.getBoundingRect) return null
  const bb = region.getBoundingRect()
  return bb.width > 0 && bb.height > 0 ? bb : null
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

// 주어진 images를 product-area bbox만큼의 offscreen canvas에 합성해 PNG dataURL 반환
// images의 x,y는 canvas px (center origin), scaleX/Y/angle은 fabric.Image와 동일 의미
async function synthesizePrintTexture(
  images: import('@/types/editor').DesignImage[],
  bb: { left: number; top: number; width: number; height: number },
  options: { flipX?: boolean } = {},
): Promise<string | null> {
  const canvas = getCanvasRef()
  if (!canvas) return null
  const visible = images.filter((i) => i.visible)
  if (visible.length === 0) return null

  // store의 img.x/y/scaleX/Y는 zoom=1 기준 — bb는 현재 fabric 캔버스(zoom 적용)에서 측정되었으므로
  // 동일 좌표계로 맞추려면 image transform을 zoom으로 곱해야 함
  const zoom = useEditorStore.getState().zoom || 1
  const cx = canvas.width / 2, cy = canvas.height / 2
  const out = document.createElement('canvas')
  out.width = Math.round(bb.width)
  out.height = Math.round(bb.height)
  const ctx = out.getContext('2d')
  if (!ctx) return null

  // bbox 좌표계로 변환 — 모든 그리기는 bbox.left/top 기준
  ctx.save()
  if (options.flipX) { ctx.translate(out.width, 0); ctx.scale(-1, 1) }
  ctx.translate(-bb.left, -bb.top)

  // 각 image를 fabric 동일 변환으로 합성 (center origin, scale, rotate)
  for (const img of visible) {
    const el = await loadHtmlImage(img.dataUrl)
    ctx.save()
    ctx.translate(cx + img.x * zoom, cy + img.y * zoom)
    ctx.rotate((img.angle * Math.PI) / 180)
    ctx.scale(img.scaleX * zoom, img.scaleY * zoom)
    ctx.drawImage(el, -el.naturalWidth / 2, -el.naturalHeight / 2)
    ctx.restore()
  }
  ctx.restore()
  return out.toDataURL('image/png')
}

// ─── 제품별 레이어 스택 정의 ─────────────────────────────────────────────────
// 사용자 스펙 기준 (front=관찰자 가까운 쪽 → back) 그대로 z축에 쌓음.
// - acrylic: 두께 있는 본체/라미 (ExtrudeGeometry)
// - cmyk:    인쇄 layer (ShapeGeometry, alphaTest로 image만)
// - white:   불투명 차단 layer (ShapeGeometry, opaque white)
// CMYK 두께·white 두께는 무시할 만큼 얇아서 z stacking용 epsilon만 사용.

type LayerSpec =
  | { kind: 'acrylic'; mm: number }
  | { kind: 'cmyk'; side: 'front' | 'back' }
  | { kind: 'white' }

function buildLayerStack(
  productType: string, isLaminate: boolean, isEmbossed: boolean, bodyThicknessMm: number, lamiMm: number,
): LayerSpec[] {
  const cmykFront: LayerSpec = { kind: 'cmyk', side: 'front' }
  const cmykBack:  LayerSpec = { kind: 'cmyk', side: 'back'  }
  const white:     LayerSpec = { kind: 'white' }
  const body:      LayerSpec = { kind: 'acrylic', mm: bodyThicknessMm }
  const lami:      LayerSpec = { kind: 'acrylic', mm: lamiMm }

  if (productType === 'corolot') {
    // 양면 보기 — 본체가 양면 CMYK 사이에 있는 sandwich 구조
    if (!isLaminate) {
      // 일반 코롯토: 아크릴 7T → CMYK → 화이트 → CMYK
      return [body, cmykFront, white, cmykBack]
    }
    if (!isEmbossed) {
      // 라미 코롯토 (양면): 1T라미 → CMYK → 화이트 → 7T본체 → CMYK → 1T라미
      return [lami, cmykFront, white, body, cmykBack, lami]
    }
    // 입체 라미 코롯토 (단면 보기): 1T라미 → 화이트 → CMYK → 7T본체 → 화이트 → CMYK → 1T라미
    return [lami, white, cmykFront, body, white, cmykBack, lami]
  }

  // 키링 / 마그넷 / 등 단면 baseline:
  //   CMYK(앞) → 화이트 → CMYK반전(뒤) → 아크릴
  // 라미 추가 시 가장 앞에 1T 라미.
  const base: LayerSpec[] = [cmykFront, white, cmykBack, body]
  return isLaminate ? [lami, ...base] : base
}

// ─── 아크릴 메쉬 ──────────────────────────────────────────────────────────────

interface AcrylicMeshProps {
  cutLine: Pt[]
  printArea: Pt[]
  holes: { x: number; y: number; r: number }[]
  thicknessMm: number
  laminateThicknessMm: number // 0이면 라미 없음
  productType: string
  isLaminate: boolean
  isEmbossed: boolean
  frontTextureUrl: string | null
  backTextureUrl: string | null
}

function AcrylicMesh({
  cutLine, printArea, holes, thicknessMm, laminateThicknessMm,
  productType, isLaminate, isEmbossed,
  frontTextureUrl, backTextureUrl,
}: AcrylicMeshProps) {
  // ── 공통 geometry: cut-line shape (with holes), printArea shape (UV 정규화) ──
  const { cutShape, printGeo, originXY } = useMemo(() => {
    if (cutLine.length < 3) return { cutShape: null, printGeo: null, originXY: { x: 0, y: 0 } }
    const cs = new THREE.Shape(cutLine.map((p) => new THREE.Vector2(p.x, -p.y)))
    for (const h of holes) {
      const hp = new THREE.Path()
      hp.absarc(h.x, -h.y, h.r, 0, Math.PI * 2, true)
      cs.holes.push(hp)
    }
    // 본체 bbox 중심을 origin 으로 잡아 모든 layer를 같은 (x,y) 위치에 정렬
    const tmp = new THREE.ExtrudeGeometry(cs, { depth: 1, bevelEnabled: false })
    tmp.computeBoundingBox()
    const bb = tmp.boundingBox!
    const cx = (bb.min.x + bb.max.x) / 2
    const cy = (bb.min.y + bb.max.y) / 2
    tmp.dispose()

    let pGeo: THREE.ShapeGeometry | null = null
    if (printArea.length >= 3) {
      const ps = new THREE.Shape(printArea.map((p) => new THREE.Vector2(p.x, -p.y)))
      pGeo = new THREE.ShapeGeometry(ps)
      pGeo.computeBoundingBox()
      const pb = pGeo.boundingBox!
      const pw = pb.max.x - pb.min.x, ph = pb.max.y - pb.min.y
      const uvArr = pGeo.attributes.uv.array as Float32Array
      for (let i = 0; i < uvArr.length; i += 2) {
        uvArr[i]     = (uvArr[i]     - pb.min.x) / pw
        uvArr[i + 1] = (uvArr[i + 1] - pb.min.y) / ph
      }
      pGeo.attributes.uv.needsUpdate = true
      pGeo.translate(-cx, -cy, 0)
    }
    return { cutShape: cs, printGeo: pGeo, originXY: { x: cx, y: cy } }
  }, [cutLine, printArea, holes])

  // ── acrylic 두께별 ExtrudeGeometry 캐싱 (스택 안에 같은 두께 라미가 여러 번 나옴) ──
  const acrylicGeo = useMemo(() => {
    const cache = new Map<number, THREE.ExtrudeGeometry>()
    if (!cutShape) return cache
    const uniqMm = new Set<number>([thicknessMm, ...(laminateThicknessMm > 0 ? [laminateThicknessMm] : [])])
    for (const mm of uniqMm) {
      const g = new THREE.ExtrudeGeometry(cutShape, { depth: mm, bevelEnabled: false })
      g.translate(-originXY.x, -originXY.y, 0)
      cache.set(mm, g)
    }
    return cache
  }, [cutShape, originXY, thicknessMm, laminateThicknessMm])

  // ── 텍스처 ──
  const frontTex = useMemo(() => {
    if (!frontTextureUrl) return null
    const t = new THREE.TextureLoader().load(frontTextureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = true
    return t
  }, [frontTextureUrl])
  const backTex = useMemo(() => {
    if (!backTextureUrl) return null
    const t = new THREE.TextureLoader().load(backTextureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = true
    return t
  }, [backTextureUrl])

  // ── 레이어 스택 → 메쉬 배열 ──
  // front=관찰자에 가까운 쪽 → z=0 부근. back으로 갈수록 z 감소.
  // 각 acrylic layer는 두께만큼 z 차지. 인쇄/화이트는 무시할 만큼 얇아 EPS만 사용.
  const stack = useMemo(
    () => buildLayerStack(productType, isLaminate, isEmbossed, thicknessMm, laminateThicknessMm),
    [productType, isLaminate, isEmbossed, thicknessMm, laminateThicknessMm],
  )

  if (!cutShape) return null

  const EPS = 0.2 // 얇은 layer 간격 (camera 거리 대비 depth buffer 정밀도 확보)
  let zFront = 0   // 다음 layer의 앞면(카메라 가까운 쪽) z 위치
  const nodes: React.ReactNode[] = []
  stack.forEach((layer, i) => {
    const key = `L${i}`
    if (layer.kind === 'acrylic') {
      // ExtrudeGeometry는 z=0..depth로 만들어졌음 → position.z = (zFront - depth)로 두면 [zFront-depth, zFront] 차지
      const geo = acrylicGeo.get(layer.mm)
      if (geo) {
        nodes.push(
          <mesh key={key} geometry={geo} position={[0, 0, zFront - layer.mm]} renderOrder={-i}>
            <meshLambertMaterial color="#ffffff" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>,
        )
      }
      zFront -= layer.mm
    } else if (layer.kind === 'white') {
      if (printGeo) {
        nodes.push(
          <mesh key={key} geometry={printGeo} position={[0, 0, zFront - EPS]} renderOrder={-i}>
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} toneMapped={false} />
          </mesh>,
        )
      }
      zFront -= EPS
    } else { // cmyk
      const tex = layer.side === 'front' ? frontTex : backTex
      if (tex && printGeo) {
        nodes.push(
          <mesh key={key} geometry={printGeo} position={[0, 0, zFront - EPS]} renderOrder={-i}>
            <meshBasicMaterial map={tex} transparent alphaTest={0.05} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>,
        )
      }
      zFront -= EPS
    }
  })

  return <group>{nodes}</group>
}

// ─── 자동 회전 ────────────────────────────────────────────────────────────────

function AutoRotate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (enabled && ref.current) ref.current.rotation.y += dt * 0.3
  })
  return <group ref={ref}>{children}</group>
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface Preview3DProps {
  autoRotate?: boolean
  background?: string
}

// 투명 본체가 어두운 배경에서 묻혀버려서 밝은 스튜디오 그라데이션을 기본값으로
const DEFAULT_BG = 'linear-gradient(180deg, #f5f5f7 0%, #c8ccd2 100%)'

export default function Preview3D({ autoRotate = true, background = DEFAULT_BG }: Preview3DProps) {
  const thickness    = useEditorStore((s) => s.thickness)
  const isLaminate   = useEditorStore((s) => s.isLaminate)
  const isEmbossed   = useEditorStore((s) => s.isEmbossed)
  const productType  = useEditorStore((s) => s.productType)
  const corolotMode  = useEditorStore((s) => s.corolotMode)
  const frontImages  = useEditorStore((s) => s.frontImages)
  const backImages   = useEditorStore((s) => s.backImages)

  // 라미 thickness — config에서 가져옴 (keyring=1, 다른 제품은 hasLaminate=false라 0)
  const laminateThicknessMm = useMemo(() => {
    if (!isLaminate) return 0
    const cfg = PRODUCTS[productType]
    return cfg.hasLaminate ? (cfg.laminateThickness ?? 1) : 0
  }, [isLaminate, productType])

  // 모달 열릴 때 1회 캡처 (props로 force re-render 시 갱신)
  const { cutLine, printArea, holes } = useMemo(() => getPolygonsMm(), [])

  // 양면 텍스처 — front/back 각각 합성. 단면 제품은 양쪽 동일 이미지 사용.
  const [textures, setTextures] = useState<{ front: string | null; back: string | null }>({ front: null, back: null })
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const bb = getProductAreaBBox()
      if (!bb) { setTextures({ front: null, back: null }); return }
      const isDualDifferent = productType === 'corolot' && corolotMode === 'different-image'
      // 양면 다른 그림: back은 backImages 합성. 그 외: back도 front 이미지 사용 (같은 그림)
      const frontSrc = frontImages
      const backSrc  = isDualDifferent ? backImages : frontImages
      // 카메라가 +z(앞)에서 print plane의 +z normal 면을 봄 → texture 그대로 정방향. flip 없음.
      // 후면 카메라(-z)는 plane의 뒷면을 봄 → UV가 시각적으로 mirror됨. back texture는 미리 flip해서 상쇄.
      const [front, back] = await Promise.all([
        synthesizePrintTexture(frontSrc, bb, { flipX: false }),
        synthesizePrintTexture(backSrc,  bb, { flipX: true  }),
      ])
      if (!cancelled) setTextures({ front, back })
    }
    run()
    return () => { cancelled = true }
  }, [productType, corolotMode, frontImages, backImages])

  // R3F의 ResizeObserver가 lazy load 타이밍에 부모 사이즈를 못 잡는 케이스를
  // 회피하기 위해 직접 wrapper 측정해 명시적 픽셀 크기를 Canvas에 전달
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    if (!wrapperRef.current) return
    const update = () => {
      const r = wrapperRef.current?.getBoundingClientRect()
      if (r && r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(wrapperRef.current)
    // R3F가 첫 mount 후 ResizeObserver를 안 fire하는 케이스 대응: window resize 강제
    const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
    return () => { ro.disconnect(); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (cutLine.length < 3) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        칼선 데이터가 없습니다.
      </div>
    )
  }

  const xs = cutLine.map((p) => p.x), ys = cutLine.map((p) => p.y)
  const sizeMm = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  // 카메라 — 본체에 충분히 가까워 hole이 잘 보이고, 약간 사선으로 두께 표현
  const camDist = sizeMm * 1.5
  const camPos: [number, number, number] = [camDist * 0.25, camDist * 0.18, camDist * 0.95]

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {size.w > 0 && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: camPos, fov: 35, near: 0.1, far: 1000 }}
          style={{ background, width: `${size.w}px`, height: `${size.h}px` }}
        >
          {/* env HDR 제거 — 회전 시 specular streak가 sparkle 원인. 단순 두 광원만 */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 15]} intensity={0.6} />
          <AutoRotate enabled={autoRotate}>
            <AcrylicMesh
              cutLine={cutLine}
              printArea={printArea}
              holes={holes}
              thicknessMm={thickness}
              laminateThicknessMm={laminateThicknessMm}
              productType={productType}
              isLaminate={isLaminate}
              isEmbossed={isEmbossed}
              frontTextureUrl={textures.front}
              backTextureUrl={textures.back}
            />
          </AutoRotate>
          <ContactShadows position={[0, -sizeMm / 2 - 1, 0]} opacity={0.3} scale={sizeMm * 2} blur={2} />
          <OrbitControls enablePan={false} minDistance={camDist * 0.5} maxDistance={camDist * 3} />
        </Canvas>
      )}
    </div>
  )
}
