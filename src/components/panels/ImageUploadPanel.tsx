import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { validateImageFile, readFileAsDataURL } from '@/utils/imageUtils'
import { MAX_FILE_SIZE, PRODUCTS } from '@/config/products'
import { convertPdfFirstPageToSvg } from '@/utils/pdfToSvg'
import type { DesignImage } from '@/types/editor'
import { MAX_IMAGES_PER_SIDE } from '@/types/editor'

// ─── 다중 이미지 업로드 dropzone ─────────────────────────────────────────────

interface MultiDropzoneProps {
  onFiles: (files: File[]) => void
  disabled: boolean
  remaining: number
}

function MultiDropzone({ onFiles, disabled, remaining }: MultiDropzoneProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }, [onFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFiles(files)
    e.target.value = ''
  }, [onFiles])

  if (disabled) {
    return (
      <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-md text-xs text-gray-300">
        최대 {MAX_IMAGES_PER_SIDE}장까지
      </div>
    )
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
    >
      <span className="text-xl text-gray-300 mb-1">🖼</span>
      <span className="text-xs text-gray-400">클릭 또는 드래그</span>
      <span className="text-[10px] text-gray-300 mt-0.5">JPG / PNG · 남은 {remaining}장</span>
      <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={handleChange} />
    </label>
  )
}

// ─── 이미지 항목 (썸네일 + 컨트롤) ───────────────────────────────────────────

interface ImageItemProps {
  image: DesignImage
  index: number
  total: number
  isSelected: boolean
  isDragOver: boolean
  onSelect: () => void
  onToggleVisible: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragLeave: (id: string) => void
  onDrop: (toId: string) => void
}

function ImageItem({ image, index, total, isSelected, isDragOver, onSelect, onToggleVisible, onMoveUp, onMoveDown, onRemove, onDragStart, onDragOver, onDragLeave, onDrop }: ImageItemProps) {
  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', image.id); onDragStart(image.id) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(image.id) }}
      onDragLeave={() => onDragLeave(image.id)}
      onDrop={(e) => { e.preventDefault(); onDrop(image.id) }}
      className={`group flex items-center gap-2 p-2 rounded-md border cursor-grab active:cursor-grabbing transition-colors ${
        isDragOver ? 'border-blue-500 bg-blue-100' :
        isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="w-12 h-12 bg-gray-50 rounded shrink-0 overflow-hidden flex items-center justify-center border border-gray-100">
        {image.visible
          ? <img src={image.dataUrl} alt={image.name} className="max-w-full max-h-full object-contain" />
          : <span className="text-gray-300 text-lg">⊘</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-700 truncate">{image.name}</div>
        <div className="text-[10px] text-gray-400">레이어 {index + 1}/{total}</div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible() }}
          title={image.visible ? '숨기기' : '표시'}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
        >
          {image.visible ? '👁' : '⊘'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp() }}
          disabled={index === total - 1}
          title="위로"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▲
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown() }}
          disabled={index === 0}
          title="아래로"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▼
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          title="삭제"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
        >
          ×
        </button>
      </div>
    </div>
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
    e.target.value = ''
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

let imageIdCounter = 0
function nextImageId(): string {
  imageIdCounter += 1
  return `img-${Date.now()}-${imageIdCounter}`
}

export default function ImageUploadPanel() {
  const productType    = useEditorStore((s) => s.productType)
  const activeSide     = useEditorStore((s) => s.activeSide)
  const cutShape       = useEditorStore((s) => s.cutShape)
  const frontImages    = useEditorStore((s) => s.frontImages)
  const backImages     = useEditorStore((s) => s.backImages)
  const cutLineSvgData = useEditorStore((s) => s.cutLineSvgData)
  const selectedId     = useEditorStore((s) => s.selectedImageId)

  const addImage         = useEditorStore((s) => s.addImage)
  const removeImage      = useEditorStore((s) => s.removeImage)
  const updateImage      = useEditorStore((s) => s.updateImage)
  const reorderImage     = useEditorStore((s) => s.reorderImage)
  const moveImageTo      = useEditorStore((s) => s.moveImageTo)
  const setSelectedImage = useEditorStore((s) => s.setSelectedImageId)
  const setCutLineSvg    = useEditorStore((s) => s.setCutLineSvgData)
  const setSize          = useEditorStore((s) => s.setSize)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const images = activeSide === 'front' ? frontImages : backImages
  const remaining = MAX_IMAGES_PER_SIDE - images.length

  const handleImageFiles = useCallback(async (files: File[]) => {
    let slot = MAX_IMAGES_PER_SIDE - (activeSide === 'front' ? frontImages.length : backImages.length)
    if (slot <= 0) {
      alert(`이미지는 한 면당 최대 ${MAX_IMAGES_PER_SIDE}장까지만 올릴 수 있습니다.`)
      return
    }
    let skipped = 0
    for (const file of files) {
      if (slot <= 0) { skipped++; continue }
      const v = validateImageFile(file)
      if (!v.valid) { alert(v.error); continue }
      try {
        const dataUrl = await readFileAsDataURL(file)
        const img: DesignImage = {
          id: nextImageId(),
          dataUrl,
          name: file.name,
          visible: true,
          x: 0, y: 0,             // 0,0 = canvas 중앙 (FabricCanvas에서 cx, cy 적용)
          scaleX: 1, scaleY: 1,
          angle: 0,
        }
        const added = addImage(activeSide, img)
        if (added) { slot--; setSelectedImage(img.id) }
      } catch (err) {
        console.error('[image] 읽기 실패', err)
      }
    }
    if (skipped > 0) alert(`${skipped}장은 최대 개수(${MAX_IMAGES_PER_SIDE}) 초과로 제외되었습니다.`)
  }, [activeSide, frontImages.length, backImages.length, addImage, setSelectedImage])

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
        const scaleDown = Math.min(maxWidth / mmW, maxHeight / mmH, 1)
        const scaleUp   = Math.max(minWidth  / mmW, minHeight  / mmH, 1)
        const scale = scaleDown < 1 ? scaleDown : scaleUp
        const round = (n: number) => Math.round(n * 2) / 2
        const fitW = Math.max(minWidth,  Math.min(maxWidth,  round(mmW * scale)))
        const fitH = Math.max(minHeight, Math.min(maxHeight, round(mmH * scale)))
        setSize(fitW, fitH)
      }
    }
  }, [setCutLineSvg, setSize, productType])

  const designSection = (prefix: string) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        {prefix}디자인 이미지 <span className="text-xs text-gray-400 font-normal">({images.length}/{MAX_IMAGES_PER_SIDE})</span>
      </h3>
      <p className="text-xs text-gray-400 mb-2">여러 장을 올려 캔버스에서 자유롭게 배치할 수 있습니다.</p>
      <MultiDropzone onFiles={handleImageFiles} disabled={remaining <= 0} remaining={remaining} />
      {images.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {/* 마지막이 가장 위에 그려짐 → 리스트는 역순으로 표시 (위가 top layer) */}
          {[...images].reverse().map((img) => {
            const realIdx = images.findIndex((i) => i.id === img.id)
            return (
              <ImageItem
                key={img.id}
                image={img}
                index={realIdx}
                total={images.length}
                isSelected={selectedId === img.id}
                isDragOver={dragOverId === img.id && draggingId !== null && draggingId !== img.id}
                onSelect={() => setSelectedImage(img.id)}
                onToggleVisible={() => updateImage(activeSide, img.id, { visible: !img.visible })}
                onMoveUp={() => reorderImage(activeSide, img.id, 'up')}
                onMoveDown={() => reorderImage(activeSide, img.id, 'down')}
                onRemove={() => removeImage(activeSide, img.id)}
                onDragStart={(id) => setDraggingId(id)}
                onDragOver={(id) => setDragOverId(id)}
                onDragLeave={(id) => setDragOverId((cur) => (cur === id ? null : cur))}
                onDrop={(toId) => {
                  if (draggingId && draggingId !== toId) moveImageTo(activeSide, draggingId, toId)
                  setDraggingId(null)
                  setDragOverId(null)
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )

  if (cutShape === 'freeform') {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">① 칼선 파일</h3>
          <p className="text-xs text-gray-400 mb-2">칼선 형태가 담긴 SVG 또는 PDF 파일을 올려주세요.</p>
          <SvgDropzone
            value={cutLineSvgData}
            onFile={handleSvgFile}
            onRemove={() => setCutLineSvg(null)}
          />
        </div>
        {designSection('② ')}
      </div>
    )
  }

  return designSection('')
}
