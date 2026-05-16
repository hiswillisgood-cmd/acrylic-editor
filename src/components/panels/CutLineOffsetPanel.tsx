import { useEditorStore } from '@/stores/editorStore'

export default function CutLineOffsetPanel() {
  const cutLineOffset = useEditorStore((s) => s.cutLineOffset)
  const setCutLineOffset = useEditorStore((s) => s.setCutLineOffset)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">칼선 오프셋</h3>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={cutLineOffset}
          onChange={(e) => setCutLineOffset(Number(e.target.value))}
          className="flex-1 accent-red-500"
        />
        <span className="text-sm font-mono text-gray-600 w-14 text-right">{cutLineOffset} mm</span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        이미지 외곽에서 칼선까지의 여백
      </p>
    </div>
  )
}
