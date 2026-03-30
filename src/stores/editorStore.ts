import { create } from 'zustand';
import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from '@/types/product';
import type { EditorSide } from '@/types/editor';
import { PRODUCTS, DEFAULT_CUT_LINE_OFFSET } from '@/config/products';

export type CutShape = 'rectangle' | 'circle' | 'freeform';

interface EditorStore {
  // Product
  productType: ProductType;
  setProductType: (type: ProductType) => void;

  // Cut shape
  cutShape: CutShape;
  setCutShape: (shape: CutShape) => void;

  // Size (mm)
  width: number;
  height: number;
  setSize: (w: number, h: number) => void;

  // Options
  cornerRadius: number;
  setCornerRadius: (r: number) => void;

  holeCount: number;
  setHoleCount: (n: number) => void;
  holePosition: HolePosition;
  setHolePosition: (pos: HolePosition) => void;

  basePlateShape: BasePlateShape;
  setBasePlateShape: (shape: BasePlateShape) => void;

  thickness: number;
  setThickness: (t: number) => void;

  corolotMode: CorolotMode;
  setCorolotMode: (mode: CorolotMode) => void;

  // Editor
  activeSide: EditorSide;
  setActiveSide: (side: EditorSide) => void;

  cutLineOffset: number;
  setCutLineOffset: (offset: number) => void;

  zoom: number;
  setZoom: (z: number) => void;

  // Images
  frontImageData: string | null;
  setFrontImageData: (data: string | null) => void;
  backImageData: string | null;
  setBackImageData: (data: string | null) => void;

  // Preview
  isPreviewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;

  // Freeform cutline points (canvas absolute coords, set by FabricCanvas)
  freeformCutLinePoints: { x: number; y: number }[] | null;
  setFreeformCutLinePoints: (pts: { x: number; y: number }[] | null) => void;

  // Contour tuning
  contourSigma: number;
  setContourSigma: (v: number) => void;
  contourSlices: number;
  setContourSlices: (v: number) => void;
  contourOffset: number;
  setContourOffset: (v: number) => void;

  // Dev: 생성된 칼선 포인트 수 (자유형 디버그용)
  contourPointCount: { outline: number; cutLine: number } | null;
  setContourPointCount: (v: { outline: number; cutLine: number } | null) => void;

  // Reset
  resetToProduct: (type: ProductType) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  productType: 'keyring',
  setProductType: (type) => set({ productType: type }),

  cutShape: 'rectangle' as CutShape,
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

  isPreviewOpen: false,
  setPreviewOpen: (open) => set({ isPreviewOpen: open }),

  freeformCutLinePoints: null,
  setFreeformCutLinePoints: (pts) => set({ freeformCutLinePoints: pts }),

  contourSigma: 3,
  setContourSigma: (v) => set({ contourSigma: v }),
  contourSlices: 60,
  setContourSlices: (v) => set({ contourSlices: v }),
  contourOffset: 2,
  setContourOffset: (v) => set({ contourOffset: v }),

  contourPointCount: null,
  setContourPointCount: (v) => set({ contourPointCount: v }),

  resetToProduct: (type) => {
    const config = PRODUCTS[type];
    set({
      productType: type,
      cutShape: 'rectangle' as CutShape,
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
      isPreviewOpen: false,
      freeformCutLinePoints: null,
      contourSigma: 3,
      contourSlices: 60,
      contourOffset: 2,
      contourPointCount: null,
    });
  },
}));
