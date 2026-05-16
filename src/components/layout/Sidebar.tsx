import type { ProductType } from '@/types/product'
import type { ReactNode } from 'react'
import { PRODUCTS } from '@/config/products'
import { useEditorStore } from '@/stores/editorStore'
import ImageUploadPanel from '@/components/panels/ImageUploadPanel'
import CutShapePanel from '@/components/panels/CutShapePanel'
import SizeInputPanel from '@/components/panels/SizeInputPanel'
import CutLineOffsetPanel from '@/components/panels/CutLineOffsetPanel'
import CornerRadiusPanel from '@/components/panels/CornerRadiusPanel'
import HoleConfigPanel from '@/components/panels/HoleConfigPanel'
import BasePlatePanel from '@/components/panels/BasePlatePanel'
import ThicknessPanel from '@/components/panels/ThicknessPanel'
import SideSelectPanel from '@/components/panels/SideSelectPanel'

interface Props { productType: ProductType }

function Section({ children }: { children: ReactNode }) {
  return <div style={{ padding: '22px 28px', borderBottom: '1px solid #e5e7eb' }}>{children}</div>
}

export default function Sidebar({ productType }: Props) {
  const config    = PRODUCTS[productType]
  const cutShape  = useEditorStore((s) => s.cutShape)

  return (
    <aside className="bg-white border-r border-gray-200 overflow-y-auto shrink-0" style={{ width: '344px' }}>
      <div style={{ padding: '22px 28px 10px' }}>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">설정</h2>
      </div>

      <Section>
        <ImageUploadPanel />
      </Section>

      <Section>
        <CutShapePanel />
      </Section>

      {/* 사이즈: 자유형에서도 표시 (SVG 업로드 시 자동 설정, 수동 조정 가능) */}
      <Section>
        <SizeInputPanel sizeConstraint={config.sizeConstraint} />
      </Section>

      {/* 칼선 오프셋: 모든 형태 공통 */}
      <Section>
        <CutLineOffsetPanel />
      </Section>

      {/* 모서리 반경: 사각형 + hasCornerRadius 제품만 */}
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
