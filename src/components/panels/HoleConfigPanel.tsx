import { useEditorStore } from '@/stores/editorStore'
import type { HolePosition } from '@/types/product'

const POSITIONS: { value: HolePosition; label: string }[] = [
  { value: 'top', label: '상단' },
  { value: 'bottom', label: '하단' },
  { value: 'left', label: '좌측' },
  { value: 'right', label: '우측' },
]

export default function HoleConfigPanel() {
  const holeCount = useEditorStore((s) => s.holeCount)
  const setHoleCount = useEditorStore((s) => s.setHoleCount)
  const holePosition = useEditorStore((s) => s.holePosition)
  const setHolePosition = useEditorStore((s) => s.setHolePosition)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">고리 설정</h3>
      <p className="text-xs text-gray-400 mb-3">
        캔버스에서 고리를 드래그하여 위치를 조정하거나, 개수를 변경할 수 있습니다.
      </p>

      {/* 고리 크기 안내 */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-md">
        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-dashed border-red-300 bg-white">
          <div className="w-4 h-4 rounded-full bg-gray-200 border border-gray-300" />
        </div>
        <div className="text-xs text-gray-500">
          <div>고리 구멍: <strong>3mm</strong></div>
          <div>고리 전체: <strong>7mm</strong></div>
        </div>
      </div>

      {/* 고리 개수 */}
      <h4 className="text-xs font-medium text-gray-500 mb-2">개수</h4>
      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            onClick={() => setHoleCount(n)}
            className={`flex-1 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
              holeCount === n
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {n}개
          </button>
        ))}
      </div>

      {/* 고리 위치 */}
      {holeCount > 0 && (
        <>
          <h4 className="text-xs font-medium text-gray-500 mb-2">위치</h4>
          <div className="flex gap-2">
            {POSITIONS.map((pos) => (
              <button
                key={pos.value}
                onClick={() => setHolePosition(pos.value)}
                className={`flex-1 py-2 text-xs rounded-md border cursor-pointer transition-colors ${
                  holePosition === pos.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
