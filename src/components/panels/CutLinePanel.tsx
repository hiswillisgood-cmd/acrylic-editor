import { useEditorStore } from '@/stores/editorStore'

export default function CutLinePanel() {
  const cutLineOffset = useEditorStore((s) => s.cutLineOffset)
  const setCutLineOffset = useEditorStore((s) => s.setCutLineOffset)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">칼선 만들기</h3>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={cutLineOffset}
          onChange={(e) => setCutLineOffset(Number(e.target.value))}
          className="flex-1 accent-red-500"
        />
        <span className="text-sm text-gray-600 w-12 text-right font-mono">{cutLineOffset} mm</span>
      </div>
    </div>
  )
}
