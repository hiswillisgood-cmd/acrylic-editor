import { useCallback, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { validateImageFile, readFileAsDataURL } from '@/utils/imageUtils'

export default function ImageUploadPanel() {
  const activeSide = useEditorStore((s) => s.activeSide)
  const setFrontImageData = useEditorStore((s) => s.setFrontImageData)
  const setBackImageData = useEditorStore((s) => s.setBackImageData)
  const frontImageData = useEditorStore((s) => s.frontImageData)
  const backImageData = useEditorStore((s) => s.backImageData)

  const cutShape = useEditorStore((s) => s.cutShape)
  const currentImage = activeSide === 'front' ? frontImageData : backImageData
  const setImage = activeSide === 'front' ? setFrontImageData : setBackImageData
  const [jpgWarning, setJpgWarning] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    // 자유형에서 JPG 업로드 시 경고
    if (cutShape === 'freeform' && file.type === 'image/jpeg') {
      setJpgWarning(true)
    } else {
      setJpgWarning(false)
    }
    const dataUrl = await readFileAsDataURL(file)
    setImage(dataUrl)
  }, [setImage, cutShape])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleRemove = () => setImage(null)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        업로드 가능한 파일: JPG, PNG
      </h3>
      <p className="text-xs text-gray-400 mb-3">
        인쇄할 이미지를 업로드하면 캔버스로 배치됩니다.
      </p>

      {currentImage ? (
        <div className="relative">
          <img
            src={currentImage}
            alt="업로드된 이미지"
            className="w-full h-32 object-contain bg-gray-50 rounded-lg border border-gray-200"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full text-xs hover:bg-red-600 cursor-pointer"
          >
            ×
          </button>
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <span className="text-2xl text-gray-300 mb-1">📁</span>
          <span className="text-xs text-gray-400">클릭 또는 드래그하여 업로드</span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleChange}
          />
        </label>
      )}

      {jpgWarning && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">자유형에는 투명 배경 PNG가 필요합니다</p>
          <p className="text-xs text-amber-600 mt-1">배경 지우기 툴을 이용하여 배경을 제거한 PNG 파일을 업로드해 주세요.</p>
        </div>
      )}
    </div>
  )
}
