import { useEditorStore } from '@/stores/editorStore'
import type { CorolotMode } from '@/types/product'

export default function SideSelectPanel() {
  const activeSide = useEditorStore((s) => s.activeSide)
  const setActiveSide = useEditorStore((s) => s.setActiveSide)
  const corolotMode = useEditorStore((s) => s.corolotMode)
  const setCorolotMode = useEditorStore((s) => s.setCorolotMode)

  const modes: { value: CorolotMode; label: string; desc: string }[] = [
    { value: 'same-image', label: '같은 그림', desc: '앞뒤 동일 이미지' },
    { value: 'different-image', label: '다른 그림', desc: '앞뒤 다른 이미지' },
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">양면 설정</h3>

      {/* Mode selection */}
      <div className="flex gap-2 mb-3">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setCorolotMode(m.value)}
            className={`flex-1 py-2 px-2 text-xs rounded-md border cursor-pointer transition-colors ${
              corolotMode === m.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Side toggle (only for different-image mode) */}
      {corolotMode === 'different-image' && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">편집 면 선택</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSide('front')}
              className={`flex-1 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
                activeSide === 'front'
                  ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              앞면
            </button>
            <button
              onClick={() => setActiveSide('back')}
              className={`flex-1 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
                activeSide === 'back'
                  ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              뒷면
            </button>
          </div>
        </>
      )}
    </div>
  )
}
