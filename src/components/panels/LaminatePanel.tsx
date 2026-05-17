import { useEditorStore } from '@/stores/editorStore'

interface Props {
  laminateThickness: number  // mm — config의 laminateThickness
  hasEmbossed?: boolean      // 입체(단면 보기) 옵션 노출 여부 — 코롯토 라미에서만 true
}

type Variant = 'normal' | 'lami' | 'embossed'

// 일반 / 라미 / 입체 라미 선택
// - 일반: 본체만 (라미 X)
// - 라미: 본체 + 양면 1T 라미. 양면 보기 (CMYK가 라미 바로 안쪽 → 화이트 → 본체)
// - 입체 라미: 본체 + 양면 1T 라미. 단면 보기 (화이트가 라미 바로 안쪽 → CMYK → 본체) — 코롯토만
export default function LaminatePanel({ laminateThickness, hasEmbossed = false }: Props) {
  const isLaminate  = useEditorStore((s) => s.isLaminate)
  const isEmbossed  = useEditorStore((s) => s.isEmbossed)
  const setLaminate = useEditorStore((s) => s.setLaminate)
  const setEmbossed = useEditorStore((s) => s.setEmbossed)

  const current: Variant = isLaminate ? (isEmbossed ? 'embossed' : 'lami') : 'normal'

  const select = (v: Variant) => {
    setLaminate(v !== 'normal')
    setEmbossed(v === 'embossed')
  }

  const opts: { value: Variant; label: string; desc: string }[] = [
    { value: 'normal',   label: '일반',     desc: '아크릴 1장' },
    { value: 'lami',     label: '라미',     desc: `+${laminateThickness}mm 합지` },
    ...(hasEmbossed ? [{ value: 'embossed' as Variant, label: '입체 라미', desc: '단면 보기' }] : []),
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">제품 종류</h3>
      <div className="flex gap-2">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={`flex-1 py-2 text-sm rounded-md border cursor-pointer transition-colors ${
              current === o.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <div>{o.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
