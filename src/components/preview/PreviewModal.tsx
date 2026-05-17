import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { getCanvasRef } from '@/stores/canvasRef'

// 3D 미리보기는 무거운 Three.js 의존성을 가지므로 lazy load — 사용자가 3D 탭 열 때만 다운로드
const Preview3D = lazy(() => import('./Preview3D'))

type PreviewTab = 'front' | 'white' | 'back' | 'side' | '3d'

const TABS: { value: PreviewTab; label: string }[] = [
  { value: 'front', label: '앞면' },
  { value: 'white', label: '화이트' },
  { value: 'back',  label: '뒷면' },
  { value: 'side',  label: '측면(자동반전)' },
  { value: '3d',    label: '3D' },
]

// 캔버스에서 user-image 객체만 보이게 한 뒤 PNG로 export, 나머지는 일시 숨김
function snapshotDesignImages(): string | null {
  const canvas = getCanvasRef()
  if (!canvas) return null
  type Maybe = { _tag?: string; visible?: boolean }
  const restore: Array<{ obj: Maybe; visible: boolean | undefined }> = []
  for (const o of canvas.getObjects()) {
    const t = (o as unknown as Maybe)._tag
    if (t !== 'user-image') {
      restore.push({ obj: o as unknown as Maybe, visible: o.visible })
      o.visible = false
    }
  }
  canvas.renderAll()
  const data = canvas.toDataURL({ format: 'png', multiplier: 1 })
  for (const r of restore) (r.obj as unknown as { visible: boolean | undefined }).visible = r.visible
  canvas.renderAll()
  return data
}

export default function PreviewModal() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('front')
  const setPreviewOpen = useEditorStore((s) => s.setPreviewOpen)
  const frontImages    = useEditorStore((s) => s.frontImages)
  const backImages     = useEditorStore((s) => s.backImages)
  const corolotMode    = useEditorStore((s) => s.corolotMode)
  const productType    = useEditorStore((s) => s.productType)
  const cutShape       = useEditorStore((s) => s.cutShape)
  const width          = useEditorStore((s) => s.width)
  const height         = useEditorStore((s) => s.height)
  const cornerRadius   = useEditorStore((s) => s.cornerRadius)
  const cutLineSvgData = useEditorStore((s) => s.cutLineSvgData)
  const activeSide     = useEditorStore((s) => s.activeSide)

  const hasDualSide  = productType === 'corolot'
  const isFreeform   = cutShape === 'freeform'

  // 활성 면 (different-image 모드의 back 탭) 결정
  const wantBack = activeTab === 'back' && corolotMode === 'different-image'
  const hasAnyImage = useMemo(
    () => (wantBack ? backImages : frontImages).some((i) => i.visible),
    [wantBack, frontImages, backImages],
  )

  // 미리보기 진입 시(또는 탭 변경 시) 캔버스 합성 PNG 캡처
  const [snapshot, setSnapshot] = useState<string | null>(null)
  useEffect(() => {
    // 다른 면(back) 미리보기는 store의 backImages를 직접 합성하기 어려우므로
    // 같은 그림 모드 또는 현재 activeSide 표시일 때만 캔버스 스냅샷 사용
    if (wantBack && activeSide !== 'back') {
      // back 면 별도 이미지가 활성화되지 않은 상태 — 첫 visible 이미지 dataUrl로 폴백
      const firstVis = backImages.find((i) => i.visible)
      setSnapshot(firstVis?.dataUrl ?? null)
    } else {
      setSnapshot(snapshotDesignImages())
    }
  }, [activeTab, wantBack, activeSide, frontImages, backImages, corolotMode])

  const displayImage = snapshot

  // 3D 탭은 항상 표시. 양면 제품은 앞/뒤/측면 추가
  const visibleTabs = TABS.filter(t =>
    t.value === '3d' || hasDualSide || (t.value === 'front' || t.value === 'white')
  )

  const previewW = Math.min(width * 3, 320)
  const previewH = Math.min(height * 3, 280)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[520px] max-w-[92vw] max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4" style={{ padding: '20px 28px 16px' }}>
          <div>
            <h2 className="font-semibold text-gray-800 text-base">미리보기</h2>
            <p className="text-xs text-gray-400" style={{ marginTop: '4px' }}>실제 인쇄 결과와 다를 수 있습니다.</p>
          </div>
          <button
            onClick={() => setPreviewOpen(false)}
            aria-label="닫기"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer shrink-0"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200" style={{ padding: '0 16px' }}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.value
                  ? 'text-red-600 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={{ padding: '10px 12px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Preview area */}
        <div className="flex items-center justify-center bg-gray-50 flex-1" style={{ padding: '32px 28px', minHeight: '300px' }}>
          {activeTab === '3d' ? (
            <div style={{ width: '100%', height: '360px', position: 'relative' }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">3D 엔진 로딩 중…</div>}>
                <Preview3D />
              </Suspense>
            </div>
          ) : isFreeform && cutLineSvgData ? (
            // 자유형: SVG 칼선 위에 이미지 오버레이
            <div className="relative flex items-center justify-center" style={{ width: previewW, height: previewH }}>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: activeTab === 'white' ? 0.15 : 1 }}
                dangerouslySetInnerHTML={{ __html: cutLineSvgData }}
              />
              {displayImage && (
                <img
                  src={displayImage}
                  alt="미리보기"
                  className="relative max-w-full max-h-full object-contain"
                  style={{
                    transform: activeTab === 'side' ? 'scaleX(-1)' : 'none',
                    opacity: activeTab === 'white' ? 0.3 : 1,
                  }}
                />
              )}
              {!displayImage && (
                <span className="relative text-gray-300 text-sm">이미지를 업로드하세요</span>
              )}
            </div>
          ) : (
            // 사각형 / 원형
            <div
              className="relative bg-white shadow-lg flex items-center justify-center overflow-hidden"
              style={{
                width: previewW,
                height: previewH,
                borderRadius: cutShape === 'circle' ? '50%' : cornerRadius * 2,
                transform: activeTab === 'side' ? 'scaleX(-1)' : 'none',
                opacity: activeTab === 'white' ? 0.3 : 1,
              }}
            >
              {displayImage
                ? <img src={displayImage} alt="미리보기" className="max-w-full max-h-full object-contain" />
                : <span className="text-gray-300 text-sm">이미지를 업로드하세요</span>
              }
            </div>
          )}
        </div>

        {/* Info */}
        <div className="border-t border-gray-200 bg-white" style={{ padding: '16px 28px 20px' }}>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span>크기: {width} × {height} mm</span>
            {cutShape === 'rectangle' && <span>모서리: {cornerRadius} mm</span>}
            {hasDualSide && <span>모드: {corolotMode === 'same-image' ? '같은 그림' : '다른 그림'}</span>}
          </div>
          <p className="text-[11px] text-red-500" style={{ marginTop: '8px' }}>* 색상 및 형태는 실제 인쇄와 다를 수 있습니다.</p>
        </div>
      </div>
    </div>
  )
}
