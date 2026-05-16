import type { EditorState, DesignImage } from '@/types/editor';

export interface Point2D { x: number; y: number }

export interface OrderData {
  productType: string;
  width: number;
  height: number;
  cornerRadius: number;
  holeCount: number;
  holePosition: string;
  basePlateShape: string;
  thickness: number;
  corolotMode: string;
  cutLineOffset: number;
  frontImages: DesignImage[];
  backImages: DesignImage[];
  frontImage: string | null;        // 합성 PNG (캔버스 export)
  cutLinePolygon: Point2D[] | null; // 칼선 외곽 + 고리 외곽이 union된 단일 path (캔버스 px)
  holePositions: Point2D[];         // 각 고리 중심 (캔버스 px) — 타공 위치 정보
  holeDiameter: number;             // 타공 지름 (mm)
  exportedAt: string;
}

export function buildOrderData(state: EditorState, opts?: { cutLinePolygon?: Point2D[] | null; holePositions?: Point2D[] }): OrderData {
  return {
    productType: state.productType,
    width: state.width,
    height: state.height,
    cornerRadius: state.cornerRadius,
    holeCount: state.holeCount,
    holePosition: state.holePosition,
    basePlateShape: state.basePlateShape,
    thickness: state.thickness,
    corolotMode: state.corolotMode,
    cutLineOffset: state.cutLineOffset,
    frontImages: state.frontImages,
    backImages: state.backImages,
    frontImage: null,
    cutLinePolygon: opts?.cutLinePolygon ?? null,
    holePositions: opts?.holePositions ?? [],
    holeDiameter: 3, // mm (inner taper hole, HoleConfigPanel에 표시되는 값과 동일)
    exportedAt: new Date().toISOString(),
  };
}

export function downloadJSON(data: OrderData, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
