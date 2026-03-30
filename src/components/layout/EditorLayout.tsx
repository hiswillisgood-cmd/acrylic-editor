import type { ProductType } from '@/types/product'
import Sidebar from './Sidebar'
import Toolbar from './Toolbar'
import FabricCanvas from '@/components/canvas/FabricCanvas'

interface Props {
  productType: ProductType
}

export default function EditorLayout({ productType }: Props) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      <Sidebar productType={productType} />

      {/* Main canvas area */}
      <div className="flex flex-col flex-1 bg-gray-100">
        <Toolbar />
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
          <FabricCanvas />
        </div>
      </div>
    </div>
  )
}
