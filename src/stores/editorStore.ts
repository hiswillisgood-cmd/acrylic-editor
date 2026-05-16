import { create } from 'zustand'
import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from '@/types/product'
import type { EditorSide } from '@/types/editor'
import { PRODUCTS, DEFAULT_CUT_LINE_OFFSET } from '@/config/products'

export type CutShape = 'rectangle' | 'circle' | 'freeform'

export interface Point { x: number; y: number }

interface EditorStore {
  productType: ProductType
  setProductType: (type: ProductType) => void

  cutShape: CutShape
  setCutShape: (shape: CutShape) => void

  width: number
  height: number
  setSize: (w: number, h: number) => void

  cornerRadius: number
  setCornerRadius: (r: number) => void

  holeCount: number
  setHoleCount: (n: number) => void
  holePosition: HolePosition
  setHolePosition: (pos: HolePosition) => void

  basePlateShape: BasePlateShape
  setBasePlateShape: (shape: BasePlateShape) => void

  thickness: number
  setThickness: (t: number) => void

  corolotMode: CorolotMode
  setCorolotMode: (mode: CorolotMode) => void

  activeSide: EditorSide
  setActiveSide: (side: EditorSide) => void

  cutLineOffset: number
  setCutLineOffset: (offset: number) => void

  zoom: number
  setZoom: (z: number) => void

  frontImageData: string | null
  setFrontImageData: (data: string | null) => void
  backImageData: string | null
  setBackImageData: (data: string | null) => void

  // 자유형 전용: 칼선 SVG 파일 내용
  cutLineSvgData: string | null
  setCutLineSvgData: (data: string | null) => void

  // 자유형 전용: 파싱된 칼선 폴리곤 (화면 좌표, FabricCanvas가 계산 후 저장)
  cutLinePolygon: Point[] | null
  setCutLinePolygon: (pts: Point[] | null) => void

  isPreviewOpen: boolean
  setPreviewOpen: (open: boolean) => void

  resetToProduct: (type: ProductType) => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  productType: 'keyring',
  setProductType: (type) => set({ productType: type }),

  cutShape: 'rectangle',
  setCutShape: (shape) => set({ cutShape: shape }),

  width: 50,
  height: 50,
  setSize: (w, h) => set({ width: w, height: h }),

  cornerRadius: 2,
  setCornerRadius: (r) => set({ cornerRadius: r }),

  holeCount: 1,
  setHoleCount: (n) => set({ holeCount: n }),
  holePosition: 'top',
  setHolePosition: (pos) => set({ holePosition: pos }),

  basePlateShape: 'circle',
  setBasePlateShape: (shape) => set({ basePlateShape: shape }),

  thickness: 15,
  setThickness: (t) => set({ thickness: t }),

  corolotMode: 'same-image',
  setCorolotMode: (mode) => set({ corolotMode: mode }),

  activeSide: 'front',
  setActiveSide: (side) => set({ activeSide: side }),

  cutLineOffset: DEFAULT_CUT_LINE_OFFSET,
  setCutLineOffset: (offset) => set({ cutLineOffset: offset }),

  zoom: 1,
  setZoom: (z) => set({ zoom: z }),

  frontImageData: null,
  setFrontImageData: (data) => set({ frontImageData: data }),
  backImageData: null,
  setBackImageData: (data) => set({ backImageData: data }),

  cutLineSvgData: null,
  setCutLineSvgData: (data) => set({ cutLineSvgData: data }),

  cutLinePolygon: null,
  setCutLinePolygon: (pts) => set({ cutLinePolygon: pts }),

  isPreviewOpen: false,
  setPreviewOpen: (open) => set({ isPreviewOpen: open }),

  resetToProduct: (type) => {
    const config = PRODUCTS[type]
    set({
      productType: type,
      cutShape: 'rectangle',
      width: config.defaultWidth,
      height: config.defaultHeight,
      cornerRadius: 2,
      holeCount: config.hasHole ? 1 : 0,
      holePosition: 'top',
      basePlateShape: 'circle',
      thickness: config.supportedThickness?.[0] ?? 15,
      corolotMode: 'same-image',
      activeSide: 'front',
      cutLineOffset: DEFAULT_CUT_LINE_OFFSET,
      zoom: 1,
      frontImageData: null,
      backImageData: null,
      cutLineSvgData: null,
      cutLinePolygon: null,
      isPreviewOpen: false,
    })
  },
}))
