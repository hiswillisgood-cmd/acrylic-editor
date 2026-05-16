import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditorStore } from '@/stores/editorStore'
import { getCanvasRef } from '@/stores/canvasRef'
import { PRODUCTS } from '@/config/products'
import type { ProductType } from '@/types/product'
import EditorLayout from '@/components/layout/EditorLayout'
import PreviewModal from '@/components/preview/PreviewModal'
import { exportCanvasAsPNG, downloadDataURL } from '@/hooks/useCanvasExport'
import { buildOrderData, downloadJSON } from '@/utils/exportUtils'

export default function Editor() {
  const { productType } = useParams<{ productType: string }>()
  const navigate = useNavigate()
  const resetToProduct = useEditorStore((s) => s.resetToProduct)
  const isPreviewOpen  = useEditorStore((s) => s.isPreviewOpen)

  useEffect(() => {
    if (!productType || !PRODUCTS[productType]) { navigate('/'); return }
    resetToProduct(productType as ProductType)
  }, [productType, navigate, resetToProduct])

  if (!productType || !PRODUCTS[productType]) return null
  const product = PRODUCTS[productType]

  return (
    <div className="flex flex-col h-screen">
      <header
        className="flex items-center justify-between bg-white shrink-0 z-10 relative"
        style={{ padding: '16px 40px', borderBottom: '2px solid #e5e7eb' }}
      >
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
          >
            ← 돌아가기
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-2xl">{product.icon}</span>
          <h1 className="font-bold text-gray-800 text-lg">{product.nameKo}</h1>
        </div>
        <div className="flex items-center gap-5">
          <ExportPNGButton />
          <PreviewButton />
          <OrderButton />
        </div>
      </header>

      <EditorLayout productType={productType as ProductType} />

      {isPreviewOpen && <PreviewModal />}
    </div>
  )
}

function ExportPNGButton() {
  const handleExport = () => {
    const canvas = getCanvasRef()
    if (!canvas) return
    const dataURL = exportCanvasAsPNG(canvas)
    if (dataURL) downloadDataURL(dataURL, `acrylic-design-${Date.now()}.png`)
  }
  return (
    <button
      onClick={handleExport}
      className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
    >
      PNG 저장
    </button>
  )
}

function PreviewButton() {
  const setPreviewOpen = useEditorStore((s) => s.setPreviewOpen)
  return (
    <button
      onClick={() => setPreviewOpen(true)}
      className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
    >
      미리보기
    </button>
  )
}

function OrderButton() {
  const handleOrder = () => {
    const s = useEditorStore.getState()
    const orderData = buildOrderData({
      productType: s.productType,
      width: s.width,
      height: s.height,
      cornerRadius: s.cornerRadius,
      holeCount: s.holeCount,
      holePosition: s.holePosition,
      basePlateShape: s.basePlateShape,
      thickness: s.thickness,
      corolotMode: s.corolotMode,
      activeSide: s.activeSide,
      cutLineOffset: s.cutLineOffset,
      zoom: s.zoom,
      frontImageData: s.frontImageData,
      backImageData: s.backImageData,
      cutLineSvgData: s.cutLineSvgData,
    })

    const canvas = getCanvasRef()
    if (canvas) orderData.frontImage = exportCanvasAsPNG(canvas)

    downloadJSON(orderData, `order-${s.productType}-${Date.now()}.json`)
    alert('주문 데이터가 다운로드되었습니다.')
  }
  return (
    <button
      onClick={handleOrder}
      className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
    >
      주문하기
    </button>
  )
}
