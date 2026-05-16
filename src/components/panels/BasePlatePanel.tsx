import { useEditorStore } from '@/stores/editorStore'
import type { BasePlateShape } from '@/types/product'

const SHAPE_LABELS: Record<BasePlateShape, { label: string; icon: string }> = {
  circle: { label: '원형', icon: '⬤' },
  rectangle: { label: '사각형', icon: '▬' },
  square: { label: '정사각', icon: '⬜' },
  hexagon: { label: '육각형', icon: '⬡' },
}

interface Props {
  shapes: BasePlateShape[]
}

export default function BasePlatePanel({ shapes }: Props) {
  const basePlateShape = useEditorStore((s) => s.basePlateShape)
  const setBasePlateShape = useEditorStore((s) => s.setBasePlateShape)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">바닥판 선택</h3>
      <div className="grid grid-cols-4 gap-2">
        {shapes.map((shape) => {
          const info = SHAPE_LABELS[shape]
          return (
            <button
              key={shape}
              onClick={() => setBasePlateShape(shape)}
              className={`flex flex-col items-center gap-1 py-3 rounded-md border cursor-pointer transition-colors ${
                basePlateShape === shape
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{info.icon}</span>
              <span className="text-xs">{info.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
