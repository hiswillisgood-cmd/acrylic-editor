import { useMemo, useRef, useEffect, useState, Suspense } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { useEditorStore } from '@/stores/editorStore'
import { getCanvasRef } from '@/stores/canvasRef'

// ─── 캔버스 px → mm 변환 (제품 중심 원점) ────────────────────────────────────

function getPolygonsMm(): { outer: { x: number; y: number }[]; holes: { x: number; y: number; r: number }[] } {
  const canvas = getCanvasRef()
  if (!canvas) return { outer: [], holes: [] }
  type Tagged = { _tag?: string }
  const s = useEditorStore.getState()
  const zoom = s.zoom || 1
  const cx = canvas.width  / 2
  const cy = canvas.height / 2
  // mm per px = 1 / (PX_PER_MM * SCREEN_SCALE * zoom)
  // unitConvert에서 mmToScreenPx(1) = MM_TO_PX * SCREEN_SCALE
  // 역수: 1 / mmToScreenPx(1) = mm per px (zoom=1 기준)
  // 따라서 px → mm = (px / (mmToScreenPx(1) * zoom))
  const PX_PER_MM = 1 / (4 * 0.33) // mmToScreenPx(1) = 4 * 0.33 = 1.32, 역수 = 0.758
  const pxToMm = (px: number) => (px / 1.32) / zoom

  const outer: { x: number; y: number }[] = []
  const holes: { x: number; y: number; r: number }[] = []
  const holeOuterR = 3.5 // mm (FabricCanvas의 outerR과 동일)

  for (const o of canvas.getObjects()) {
    const tag = (o as unknown as Tagged)._tag
    if (tag === 'cut-line' && (o as THREE.Object3D & { points?: { x: number; y: number }[] }).points) {
      const pts = (o as unknown as { points: { x: number; y: number }[] }).points
      for (const p of pts) {
        outer.push({ x: pxToMm(p.x - cx), y: pxToMm(p.y - cy) })
      }
    } else if (tag === 'hole') {
      holes.push({
        x: pxToMm((o.left ?? 0) - cx),
        y: pxToMm((o.top  ?? 0) - cy),
        r: 1.5, // mm — drill 반지름 (HoleConfigPanel의 inner 3mm 지름)
      })
      void PX_PER_MM // suppress unused
      void holeOuterR
    }
  }
  return { outer, holes }
}

// ─── 인쇄 텍스처 (캔버스에서 합성 PNG 캡처) ──────────────────────────────────

function captureDesignTexture(): string | null {
  const canvas = getCanvasRef()
  if (!canvas) return null
  type Maybe = { _tag?: string; visible?: boolean }
  const restore: Array<{ obj: Maybe; visible: boolean | undefined }> = []
  // user-image만 남기고 나머지(product/cut-line/hole) 숨김
  for (const o of canvas.getObjects()) {
    const tag = (o as unknown as Maybe)._tag
    if (tag !== 'user-image') {
      restore.push({ obj: o as unknown as Maybe, visible: o.visible })
      o.visible = false
    }
  }
  canvas.renderAll()
  const data = canvas.toDataURL({ format: 'png', multiplier: 2 })
  for (const r of restore) (r.obj as unknown as { visible: boolean | undefined }).visible = r.visible
  canvas.renderAll()
  return data
}

// ─── 아크릴 메쉬 ──────────────────────────────────────────────────────────────

interface AcrylicMeshProps {
  outer: { x: number; y: number }[]
  holes: { x: number; y: number; r: number }[]
  thicknessMm: number
  textureUrl: string | null
}

function AcrylicMesh({ outer, holes, thicknessMm, textureUrl }: AcrylicMeshProps) {
  // ExtrudeGeometry — Y 축 flip (캔버스는 y down, three.js는 y up)
  const geometry = useMemo(() => {
    if (outer.length < 3) return null
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.y)))
    for (const h of holes) {
      const holePath = new THREE.Path()
      holePath.absarc(h.x, -h.y, h.r, 0, Math.PI * 2, false)
      shape.holes.push(holePath)
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thicknessMm,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 2,
    })
    geo.center()
    // 두께 방향(z)을 카메라 방향으로 — 정면에서 봤을 때 두께가 보이도록
    geo.rotateY(0)
    return geo
  }, [outer, holes, thicknessMm])

  // 인쇄 텍스처 (dataURL → TextureLoader)
  const texture = useMemo(() => {
    if (!textureUrl) return null
    const t = new THREE.TextureLoader().load(textureUrl)
    t.colorSpace = THREE.SRGBColorSpace
    // 한 면 인쇄 — 캔버스 좌표계(y down) → three.js(y up) 보정으로 V flip
    t.flipY = true
    return t
  }, [textureUrl])

  // outer bbox로 UV 매핑 (ExtrudeGeometry 기본 UV는 안 맞음 → 정면 평면 fit)
  const printPlaneGeom = useMemo(() => {
    if (outer.length < 3) return null
    const xs = outer.map((p) => p.x), ys = outer.map((p) => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const w = maxX - minX, h = maxY - minY
    return { w, h }
  }, [outer])

  if (!geometry) return null

  return (
    <group>
      {/* 투명 아크릴 본체 */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.95}
          ior={1.49}
          roughness={0.08}
          thickness={thicknessMm}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 한 면 인쇄 — 뒷면(z = -thickness/2)에 plane으로 부착 */}
      {texture && printPlaneGeom && (
        <mesh position={[0, 0, -thicknessMm / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[printPlaneGeom.w, printPlaneGeom.h]} />
          <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
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

export default function Preview3D({ autoRotate = true, background = '#1a1a1a' }: Preview3DProps) {
  const thickness = useEditorStore((s) => s.thickness)

  // 모달 열릴 때 1회 캡처 (props로 force re-render 시 갱신)
  const { outer, holes } = useMemo(() => getPolygonsMm(), [])
  const texture = useMemo(() => captureDesignTexture(), [])

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

  if (outer.length < 3) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        칼선 데이터가 없습니다.
      </div>
    )
  }

  const xs = outer.map((p) => p.x), ys = outer.map((p) => p.y)
  const sizeMm = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const camDist = sizeMm * 2.2

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {size.w > 0 && (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, camDist], fov: 35, near: 0.1, far: 1000 }}
          style={{ background, width: `${size.w}px`, height: `${size.h}px` }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 15]} intensity={1.0} castShadow />
          <Suspense fallback={null}>
            <Environment preset="city" />
          </Suspense>
          <AutoRotate enabled={autoRotate}>
            <AcrylicMesh outer={outer} holes={holes} thicknessMm={thickness} textureUrl={texture} />
          </AutoRotate>
          <ContactShadows position={[0, -sizeMm / 2 - 1, 0]} opacity={0.3} scale={sizeMm * 2} blur={2} />
          <OrbitControls enablePan={false} minDistance={camDist * 0.5} maxDistance={camDist * 3} />
        </Canvas>
      )}
    </div>
  )
}
