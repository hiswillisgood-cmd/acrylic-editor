import type { ProductType } from '@/types/product'
import type { ReactNode } from 'react'
import { PRODUCTS } from '@/config/products'
import { useEditorStore } from '@/stores/editorStore'
import ImageUploadPanel from '@/components/panels/ImageUploadPanel'
import CutShapePanel from '@/components/panels/CutShapePanel'
import SizeInputPanel from '@/components/panels/SizeInputPanel'
import ContourTuningPanel from '@/components/panels/ContourTuningPanel'
import CornerRadiusPanel from '@/components/panels/CornerRadiusPanel'
import HoleConfigPanel from '@/components/panels/HoleConfigPanel'
import BasePlatePanel from '@/components/panels/BasePlatePanel'
import ThicknessPanel from '@/components/panels/ThicknessPanel'
import SideSelectPanel from '@/components/panels/SideSelectPanel'

interface Props {
  productType: ProductType
}

function Section({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb' }}>
      {children}
    </div>
  )
}

export default function Sidebar({ productType }: Props) {
  const config = PRODUCTS[productType]
  const cutShape = useEditorStore((s) => s.cutShape)

  return (
    <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
      <div style={{ padding: '20px 28px 8px' }}>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">설정</h2>
      </div>

      <Section>
        <ImageUploadPanel />
      </Section>

      {/* 대지 형태 선택 */}
      <Section>
        <CutShapePanel />
      </Section>

      <Section>
        <SizeInputPanel sizeConstraint={config.sizeConstraint} />
      </Section>

      {/* 칼선 미세조정 — 모든 형태 공통 (자유형에서만 스무딩/정밀도 추가) */}
      <Section>
        <ContourTuningPanel />
      </Section>

      {/* 모서리 반경 - 사각형에서만 */}
      {config.hasCornerRadius && cutShape === 'rectangle' && (
        <Section>
          <CornerRadiusPanel />
        </Section>
      )}

      {config.hasHole && (
        <Section>
          <HoleConfigPanel />
        </Section>
      )}

      {config.hasDualSide && (
        <Section>
          <SideSelectPanel />
        </Section>
      )}

      {config.hasBasePlate && (
        <Section>
          <BasePlatePanel shapes={config.supportedBasePlates ?? []} />
        </Section>
      )}

      {config.hasThickness && (
        <Section>
          <ThicknessPanel options={config.supportedThickness ?? []} />
        </Section>
      )}
    </aside>
  )
}
