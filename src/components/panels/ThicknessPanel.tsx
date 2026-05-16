import { useEditorStore } from '@/stores/editorStore'

interface Props {
  options: number[]
}

export default function ThicknessPanel({ options }: Props) {
  const thickness = useEditorStore((s) => s.thickness)
  const setThickness = useEditorStore((s) => s.setThickness)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">두께 선택</h3>
      <div className="flex gap-2">
        {options.map((t) => (
          <button
            key={t}
            onClick={() => setThickness(t)}
            className={`flex-1 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
              thickness === t
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {t}mm
          </button>
        ))}
      </div>
    </div>
  )
}
