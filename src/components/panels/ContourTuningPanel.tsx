import { useEditorStore } from '@/stores/editorStore'

export default function ContourTuningPanel() {
  const cutShape = useEditorStore((s) => s.cutShape)
  const cutLineOffset = useEditorStore((s) => s.cutLineOffset)
  const setCutLineOffset = useEditorStore((s) => s.setCutLineOffset)
  const sigma = useEditorStore((s) => s.contourSigma)
  const setSigma = useEditorStore((s) => s.setContourSigma)
  const slices = useEditorStore((s) => s.contourSlices)
  const setSlices = useEditorStore((s) => s.setContourSlices)
  const offset = useEditorStore((s) => s.contourOffset)
  const setOffset = useEditorStore((s) => s.setContourOffset)
  const pointCount = useEditorStore((s) => s.contourPointCount)

  const isFreeform = cutShape === 'freeform'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">칼선 미세조정</h3>
        {/* 개발용: 자유형 칼선 포인트 수 */}
        {isFreeform && pointCount && (
          <div className="flex items-center gap-1">
            <span
              title="외곽선 포인트 수 (스무딩 전)"
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 cursor-default"
            >
              {pointCount.outline}pts
            </span>
            <span className="text-[10px] text-gray-400">→</span>
            <span
              title="칼선 포인트 수 (오프셋 후)"
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-600 cursor-default"
            >
              {pointCount.cutLine}pts
            </span>
          </div>
        )}
      </div>

      {/* 오프셋 — 모든 대지 형태 공통 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">오프셋 (mm)</label>
          <span className="text-xs font-mono text-gray-600">
            {isFreeform ? offset : cutLineOffset}
          </span>
        </div>
        <input
          type="range" min={0} max={5} step={0.5}
          value={isFreeform ? offset : cutLineOffset}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (isFreeform) setOffset(v)
            else setCutLineOffset(v)
          }}
          className="w-full accent-red-500"
        />
      </div>

      {/* 스무딩 — 자유형에서만 */}
      {isFreeform && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">스무딩</label>
            <span className="text-xs font-mono text-gray-600">{sigma}</span>
          </div>
          <input
            type="range" min={1} max={8} step={0.5} value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* 정밀도 — 자유형에서만 */}
      {isFreeform && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">정밀도</label>
            <span className="text-xs font-mono text-gray-600">{slices}</span>
          </div>
          <input
            type="range" min={24} max={120} step={6} value={slices}
            onChange={(e) => setSlices(Number(e.target.value))}
            className="w-full accent-green-500"
          />
        </div>
      )}
    </div>
  )
}
