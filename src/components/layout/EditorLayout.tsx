import type { WheelEvent } from 'react'
import type { ProductType } from '@/types/product'
import Sidebar from './Sidebar'
import Toolbar from './Toolbar'
import FabricCanvas from '@/components/canvas/FabricCanvas'
import { useEditorStore } from '@/stores/editorStore'

interface Props {
  productType: ProductType
}

export default function EditorLayout({ productType }: Props) {
  // 캔버스 영역(우측 전체) 어디서 휠을 굴려도 zoom — fabric의 mouse:wheel은 캔버스 내부 한정이라
  // padding/여백에서 안 먹는 문제 해결
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const curr = useEditorStore.getState().zoom
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    useEditorStore.getState().setZoom(Math.min(3, Math.max(0.3, curr + delta)))
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <Sidebar productType={productType} />

      {/* Main canvas area */}
      <div className="flex flex-col flex-1 bg-gray-100">
        <Toolbar />
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4" onWheel={onWheel}>
          <FabricCanvas />
        </div>
      </div>
    </div>
  )
}
