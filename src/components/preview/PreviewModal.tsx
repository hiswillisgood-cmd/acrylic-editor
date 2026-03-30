import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'

type PreviewTab = 'front' | 'white' | 'back' | 'side'

const TABS: { value: PreviewTab; label: string }[] = [
  { value: 'front', label: '앞면' },
  { value: 'white', label: '화이트' },
  { value: 'back', label: '뒷면' },
  { value: 'side', label: '측면(자동반전)' },
]

export default function PreviewModal() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('front')
  const setPreviewOpen = useEditorStore((s) => s.setPreviewOpen)
  const frontImage = useEditorStore((s) => s.frontImageData)
  const backImage = useEditorStore((s) => s.backImageData)
  const corolotMode = useEditorStore((s) => s.corolotMode)
  const productType = useEditorStore((s) => s.productType)
  const width = useEditorStore((s) => s.width)
  const height = useEditorStore((s) => s.height)
  const cornerRadius = useEditorStore((s) => s.cornerRadius)

  const hasDualSide = productType === 'corolot'
  const displayImage = activeTab === 'back' && corolotMode === 'different-image'
    ? backImage
    : frontImage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-w-[90vw] max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-800 text-lg">미리보기</h2>
            <p className="text-xs text-gray-400 mt-1">
              CHECK [미리보기] 클릭 후 확인!!
            </p>
          </div>
          <button
            onClick={() => setPreviewOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-xl cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {TABS.filter((t) => hasDualSide || t.value === 'front' || t.value === 'white').map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.value
                  ? 'text-red-600 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Preview area */}
        <div className="p-8 flex items-center justify-center min-h-[350px] bg-gray-50">
          <div
            className="relative bg-white shadow-lg flex items-center justify-center overflow-hidden"
            style={{
              width: Math.min(width * 3, 400),
              height: Math.min(height * 3, 350),
              borderRadius: cornerRadius * 2,
              transform: activeTab === 'side' ? 'scaleX(-1)' : 'none',
              opacity: activeTab === 'white' ? 0.3 : 1,
            }}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt="미리보기"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-gray-300 text-sm">이미지를 업로드하세요</div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span>크기: {width} × {height} mm</span>
            <span>모서리: {cornerRadius} mm</span>
            {hasDualSide && <span>모드: {corolotMode === 'same-image' ? '같은 그림' : '다른 그림'}</span>}
          </div>
          <p className="text-xs text-red-500 mt-2">
            * 미리보기 모드의 색상과 실제 인쇄 결과는 다를 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
