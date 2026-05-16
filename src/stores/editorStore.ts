import { create } from 'zustand'
import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from '@/types/product'
import type { EditorSide, DesignImage } from '@/types/editor'
import { MAX_IMAGES_PER_SIDE } from '@/types/editor'
import { PRODUCTS, DEFAULT_CUT_LINE_OFFSET } from '@/config/products'

export type CutShape = 'rectangle' | 'circle' | 'freeform'

export interface Point { x: number; y: number }

export type { DesignImage } from '@/types/editor'

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

  // 양면 완전 독립 — 앞/뒤 각각 디자인 이미지 배열
  frontImages: DesignImage[]
  backImages: DesignImage[]
  addImage: (side: EditorSide, img: DesignImage) => boolean // false면 max 초과로 거부
  removeImage: (side: EditorSide, id: string) => void
  updateImage: (side: EditorSide, id: string, patch: Partial<DesignImage>) => void
  reorderImage: (side: EditorSide, id: string, direction: 'up' | 'down') => void
  moveImageTo: (side: EditorSide, fromId: string, toId: string) => void
  selectedImageId: string | null
  setSelectedImageId: (id: string | null) => void

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

  frontImages: [],
  backImages: [],
  selectedImageId: null,
  setSelectedImageId: (id) => set({ selectedImageId: id }),
  addImage: (side, img) => {
    const key = side === 'front' ? 'frontImages' : 'backImages'
    let added = false
    set((s) => {
      const list = s[key]
      if (list.length >= MAX_IMAGES_PER_SIDE) return s
      added = true
      return { [key]: [...list, img] } as Partial<EditorStore>
    })
    return added
  },
  removeImage: (side, id) => {
    const key = side === 'front' ? 'frontImages' : 'backImages'
    set((s) => ({
      [key]: s[key].filter((i) => i.id !== id),
      selectedImageId: s.selectedImageId === id ? null : s.selectedImageId,
    } as Partial<EditorStore>))
  },
  updateImage: (side, id, patch) => {
    const key = side === 'front' ? 'frontImages' : 'backImages'
    set((s) => ({
      [key]: s[key].map((i) => (i.id === id ? { ...i, ...patch } : i)),
    } as Partial<EditorStore>))
  },
  reorderImage: (side, id, direction) => {
    const key = side === 'front' ? 'frontImages' : 'backImages'
    set((s) => {
      const list = s[key]
      const idx = list.findIndex((i) => i.id === id)
      if (idx < 0) return s
      const target = direction === 'up' ? idx + 1 : idx - 1
      if (target < 0 || target >= list.length) return s
      const next = list.slice()
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return { [key]: next } as Partial<EditorStore>
    })
  },
  moveImageTo: (side, fromId, toId) => {
    const key = side === 'front' ? 'frontImages' : 'backImages'
    set((s) => {
      const list = s[key]
      const fromIdx = list.findIndex((i) => i.id === fromId)
      const toIdx   = list.findIndex((i) => i.id === toId)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return s
      const next = list.slice()
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return { [key]: next } as Partial<EditorStore>
    })
  },

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
      frontImages: [],
      backImages: [],
      selectedImageId: null,
      cutLineSvgData: null,
      cutLinePolygon: null,
      isPreviewOpen: false,
    })
  },
}))

// dev 편의: 콘솔에서 store 접근 가능
if (import.meta.env.DEV) {
  ;(window as unknown as { __editorStore?: typeof useEditorStore }).__editorStore = useEditorStore
}
