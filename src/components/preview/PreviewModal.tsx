import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'

type PreviewTab = 'front' | 'white' | 'back' | 'side'

const TABS: { value: PreviewTab; label: string }[] = [
  { value: 'front', label: '앞면' },
  { value: 'white', label: '화이트' },
  { value: 'back',  label: '뒷면' },
  { value: 'side',  label: '측면(자동반전)' },
]

export default function PreviewModal() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('front')
  const setPreviewOpen = useEditorStore((s) => s.setPreviewOpen)
  const frontImage     = useEditorStore((s) => s.frontImageData)
  const backImage      = useEditorStore((s) => s.backImageData)
  const corolotMode    = useEditorStore((s) => s.corolotMode)
  const productType    = useEditorStore((s) => s.productType)
  const cutShape       = useEditorStore((s) => s.cutShape)
  const width          = useEditorStore((s) => s.width)
  const height         = useEditorStore((s) => s.height)
  const cornerRadius   = useEditorStore((s) => s.cornerRadius)
  const cutLineSvgData = useEditorStore((s) => s.cutLineSvgData)

  const hasDualSide  = productType === 'corolot'
  const isFreeform   = cutShape === 'freeform'
  const displayImage = (activeTab === 'back' && corolotMode === 'different-image') ? backImage : frontImage

  const visibleTabs = TABS.filter(t =>
    hasDualSide || (t.value === 'front' || t.value === 'white')
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
          {isFreeform && cutLineSvgData ? (
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
