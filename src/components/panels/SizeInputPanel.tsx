import { useEditorStore } from '@/stores/editorStore'
import type { SizeConstraint } from '@/types/product'

interface Props {
  sizeConstraint: SizeConstraint
}

export default function SizeInputPanel({ sizeConstraint }: Props) {
  const width = useEditorStore((s) => s.width)
  const height = useEditorStore((s) => s.height)
  const setSize = useEditorStore((s) => s.setSize)

  const handleWidth = (v: string) => {
    const n = Number(v)
    if (!isNaN(n)) {
      setSize(
        Math.max(sizeConstraint.minWidth, Math.min(sizeConstraint.maxWidth, n)),
        height,
      )
    }
  }

  const handleHeight = (v: string) => {
    const n = Number(v)
    if (!isNaN(n)) {
      setSize(
        width,
        Math.max(sizeConstraint.minHeight, Math.min(sizeConstraint.maxHeight, n)),
      )
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">제품 사이즈 입력 (mm)</h3>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-400">가로</label>
          <input
            type="number"
            value={width}
            onChange={(e) => handleWidth(e.target.value)}
            min={sizeConstraint.minWidth}
            max={sizeConstraint.maxWidth}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <span className="text-gray-400 mt-5">×</span>
        <div className="flex-1">
          <label className="text-xs text-gray-400">세로</label>
          <input
            type="number"
            value={height}
            onChange={(e) => handleHeight(e.target.value)}
            min={sizeConstraint.minHeight}
            max={sizeConstraint.maxHeight}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        범위: {sizeConstraint.minWidth}~{sizeConstraint.maxWidth} × {sizeConstraint.minHeight}~{sizeConstraint.maxHeight} mm
      </p>
    </div>
  )
}
