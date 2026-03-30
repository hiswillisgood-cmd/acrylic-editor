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
import type { EditorState } from '@/types/editor'

export default function Editor() {
  const { productType } = useParams<{ productType: string }>()
  const navigate = useNavigate()
  const resetToProduct = useEditorStore((s) => s.resetToProduct)
  const isPreviewOpen = useEditorStore((s) => s.isPreviewOpen)

  useEffect(() => {
    if (!productType || !PRODUCTS[productType]) {
      navigate('/')
      return
    }
    resetToProduct(productType as ProductType)
  }, [productType, navigate, resetToProduct])

  if (!productType || !PRODUCTS[productType]) return null

  const product = PRODUCTS[productType]

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between bg-white shadow-sm shrink-0 z-10 relative" style={{ padding: '20px 40px', borderBottom: '2px solid #e5e7eb' }}>
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
        <div className="flex items-center gap-3">
          <ExportPNGButton />
          <PreviewButton />
          <OrderButton />
        </div>
      </header>

      {/* Editor area */}
      <EditorLayout productType={productType as ProductType} />

      {/* Preview modal */}
      {isPreviewOpen && <PreviewModal />}
    </div>
  )
}

function ExportPNGButton() {
  const handleExport = () => {
    const canvas = getCanvasRef()
    if (!canvas) return
    const dataURL = exportCanvasAsPNG(canvas)
    if (dataURL) {
      downloadDataURL(dataURL, `acrylic-design-${Date.now()}.png`)
    }
  }

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
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
      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors cursor-pointer"
    >
      미리 보기
    </button>
  )
}

function OrderButton() {
  const handleOrder = () => {
    const state = useEditorStore.getState()
    const orderData = buildOrderData(state as unknown as EditorState)

    // Export canvas image
    const canvas = getCanvasRef()
    if (canvas) {
      const png = exportCanvasAsPNG(canvas)
      orderData.frontImage = png
    }

    downloadJSON(orderData, `order-${state.productType}-${Date.now()}.json`)
    alert('주문 데이터가 다운로드되었습니다.\n실제 서비스에서는 서버로 전송됩니다.')
  }

  return (
    <button
      onClick={handleOrder}
      className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
    >
      주문하기
    </button>
  )
}
