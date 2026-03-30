import { useEditorStore } from '@/stores/editorStore'

export default function CornerRadiusPanel() {
  const cornerRadius = useEditorStore((s) => s.cornerRadius)
  const setCornerRadius = useEditorStore((s) => s.setCornerRadius)

  const presets = [
    { label: '1mm', value: 1, icon: '◻' },
    { label: '2mm', value: 2, icon: '▢' },
    { label: '4mm', value: 4, icon: '⬭' },
    { label: '8mm', value: 8, icon: '⬬' },
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">모서리 반경</h3>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={cornerRadius}
          onChange={(e) => setCornerRadius(Number(e.target.value))}
          className="flex-1 accent-blue-500"
        />
        <span className="text-sm text-gray-600 w-12 text-right font-mono">{cornerRadius} mm</span>
      </div>
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => setCornerRadius(p.value)}
            className={`flex-1 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
              cornerRadius === p.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <div>{p.icon}</div>
            <div>{p.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
