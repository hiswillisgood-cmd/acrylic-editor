import { useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { validateImageFile, readFileAsDataURL } from '@/utils/imageUtils'
import { MAX_FILE_SIZE, PRODUCTS } from '@/config/products'
import { convertPdfFirstPageToSvg } from '@/utils/pdfToSvg'

// ─── 이미지 업로드 (JPG / PNG) ───────────────────────────────────────────────

interface ImageDropzoneProps {
  value: string | null
  onFile: (file: File) => void
  onRemove: () => void
  label: string
}

function ImageDropzone({ value, onFile, onRemove, label }: ImageDropzoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  if (value) {
    return (
      <div className="relative">
        <img src={value} alt={label} className="w-full h-28 object-contain bg-gray-50 rounded-md border border-gray-200" />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full text-xs hover:bg-red-600 cursor-pointer"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
    >
      <span className="text-2xl text-gray-300 mb-1">🖼</span>
      <span className="text-xs text-gray-400">클릭 또는 드래그 (JPG / PNG)</span>
      <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleChange} />
    </label>
  )
}

// ─── SVG 칼선 업로드 ──────────────────────────────────────────────────────────

interface SvgDropzoneProps {
  value: string | null
  onFile: (file: File) => void
  onRemove: () => void
}

function SvgDropzone({ value, onFile, onRemove }: SvgDropzoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  if (value) {
    return (
      <div className="relative">
        <div
          className="w-full h-28 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-center overflow-hidden"
          dangerouslySetInnerHTML={{ __html: value }}
        />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full text-xs hover:bg-red-600 cursor-pointer"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-red-200 rounded-md cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors"
    >
      <span className="text-2xl text-red-200 mb-1">✂</span>
      <span className="text-xs text-gray-400">클릭 또는 드래그 (SVG / PDF)</span>
      <input type="file" accept=".svg,.pdf,image/svg+xml,application/pdf" className="hidden" onChange={handleChange} />
    </label>
  )
}

// ─── 메인 패널 ────────────────────────────────────────────────────────────────

export default function ImageUploadPanel() {
  const productType     = useEditorStore((s) => s.productType)
  const activeSide      = useEditorStore((s) => s.activeSide)
  const cutShape        = useEditorStore((s) => s.cutShape)
  const frontImageData  = useEditorStore((s) => s.frontImageData)
  const backImageData   = useEditorStore((s) => s.backImageData)
  const cutLineSvgData  = useEditorStore((s) => s.cutLineSvgData)
  const setFrontImage   = useEditorStore((s) => s.setFrontImageData)
  const setBackImage    = useEditorStore((s) => s.setBackImageData)
  const setCutLineSvg   = useEditorStore((s) => s.setCutLineSvgData)
  const setSize         = useEditorStore((s) => s.setSize)

  const currentImage = activeSide === 'front' ? frontImageData : backImageData
  const setCurrentImage = activeSide === 'front' ? setFrontImage : setBackImage

  const handleImageFile = useCallback(async (file: File) => {
    const v = validateImageFile(file)
    if (!v.valid) { alert(v.error); return }
    const dataUrl = await readFileAsDataURL(file)
    setCurrentImage(dataUrl)
  }, [setCurrentImage])

  const handleSvgFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
    const isSvg = name.endsWith('.svg') || file.type === 'image/svg+xml'
    if (!isPdf && !isSvg) {
      alert('SVG 또는 PDF 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('파일 크기가 20MB를 초과합니다.')
      return
    }

    let text: string
    try {
      text = isPdf ? await convertPdfFirstPageToSvg(file) : await file.text()
    } catch (err) {
      console.error('[cut-line] 파일 처리 실패', err)
      alert(`파일을 읽지 못했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      return
    }
    setCutLineSvg(text)

    // SVG width/height에서 mm 크기 자동 감지 → 제품 sizeConstraint로 비율 유지 fit
    const match = text.match(/<svg[^>]*>/)
    if (match) {
      const tag = match[0]
      const wAttr = tag.match(/\bwidth="([^"]+)"/)
      const hAttr = tag.match(/\bheight="([^"]+)"/)
      const parseMm = (val: string) => {
        const m = val.match(/^([\d.]+)\s*(mm)?$/)
        return m ? parseFloat(m[1]) : null
      }
      const mmW = wAttr ? parseMm(wAttr[1]) : null
      const mmH = hAttr ? parseMm(hAttr[1]) : null
      if (mmW && mmH && mmW > 0 && mmH > 0) {
        const { minWidth, maxWidth, minHeight, maxHeight } = PRODUCTS[productType].sizeConstraint
        // 비율 유지: 큰 쪽이 max에 맞도록, 작은 쪽이 min 미만이면 min에 맞도록 단일 scale
        const scaleDown = Math.min(maxWidth / mmW, maxHeight / mmH, 1)
        const scaleUp   = Math.max(minWidth  / mmW, minHeight  / mmH, 1)
        const scale = scaleDown < 1 ? scaleDown : scaleUp
        // 0.5mm 단위로 반올림해서 사이드바 표시가 깔끔하도록
        const round = (n: number) => Math.round(n * 2) / 2
        const fitW = Math.max(minWidth,  Math.min(maxWidth,  round(mmW * scale)))
        const fitH = Math.max(minHeight, Math.min(maxHeight, round(mmH * scale)))
        setSize(fitW, fitH)
      }
    }
  }, [setCutLineSvg, setSize, productType])

  if (cutShape === 'freeform') {
    return (
      <div className="space-y-5">
        {/* 칼선 SVG */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">① 칼선 파일</h3>
          <p className="text-xs text-gray-400 mb-2">칼선 형태가 담긴 SVG 또는 PDF 파일을 올려주세요.</p>
          <SvgDropzone
            value={cutLineSvgData}
            onFile={handleSvgFile}
            onRemove={() => setCutLineSvg(null)}
          />
        </div>

        {/* 디자인 이미지 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">② 디자인 이미지</h3>
          <p className="text-xs text-gray-400 mb-2">인쇄할 이미지를 올려주세요.</p>
          <ImageDropzone
            value={currentImage}
            onFile={handleImageFile}
            onRemove={() => setCurrentImage(null)}
            label="디자인 이미지"
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">디자인 이미지</h3>
      <p className="text-xs text-gray-400 mb-3">인쇄할 이미지를 올려주세요 (JPG / PNG).</p>
      <ImageDropzone
        value={currentImage}
        onFile={handleImageFile}
        onRemove={() => setCurrentImage(null)}
        label="디자인 이미지"
      />
    </div>
  )
}
