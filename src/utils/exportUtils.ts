import type { EditorState } from '@/types/editor';

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
  frontImage: string | null;
  backImage: string | null;
  exportedAt: string;
}

export function buildOrderData(state: EditorState): OrderData {
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
    frontImage: state.frontImageData,
    backImage: state.backImageData,
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
