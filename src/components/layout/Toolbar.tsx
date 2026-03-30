import { useEditorStore } from '@/stores/editorStore'

export default function Toolbar() {
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)

  const zoomIn = () => setZoom(Math.min(zoom + 0.1, 3))
  const zoomOut = () => setZoom(Math.max(zoom - 0.1, 0.3))
  const zoomReset = () => setZoom(1)

  return (
    <div className="flex items-center justify-between bg-white shrink-0" style={{ padding: '14px 24px', borderBottom: '1px solid #e5e7eb' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">확대/축소</span>
        <button
          onClick={zoomOut}
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-sm cursor-pointer"
        >
          −
        </button>
        <button
          onClick={zoomReset}
          className="px-2 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-xs font-mono cursor-pointer"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-sm cursor-pointer"
        >
          +
        </button>
      </div>

      <div className="text-xs text-gray-400">
        마우스 휠로 확대/축소 | 드래그로 이미지 이동
      </div>
    </div>
  )
}
