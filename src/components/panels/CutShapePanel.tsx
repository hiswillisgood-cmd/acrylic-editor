import { useEditorStore } from '@/stores/editorStore'
import type { CutShape } from '@/stores/editorStore'

const SHAPES: { value: CutShape; label: string; desc: string }[] = [
  { value: 'rectangle', label: '사각형', desc: '사각 라운드 칼선' },
  { value: 'circle', label: '원형', desc: '원형/타원형 칼선' },
  { value: 'freeform', label: '자유형', desc: 'SVG 칼선 파일 업로드' },
]

export default function CutShapePanel() {
  const cutShape = useEditorStore((s) => s.cutShape)
  const setCutShape = useEditorStore((s) => s.setCutShape)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">대지 형태</h3>
      <div className="flex gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setCutShape(s.value)}
            className={`flex-1 py-2 px-1 text-xs rounded-md border cursor-pointer transition-colors ${
              cutShape === s.value
                ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{s.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
