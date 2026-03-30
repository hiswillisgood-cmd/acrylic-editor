import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from './product';

export type EditorSide = 'front' | 'back';

export interface EditorState {
  productType: ProductType;
  width: number;
  height: number;
  cornerRadius: number;
  holeCount: number;
  holePosition: HolePosition;
  basePlateShape: BasePlateShape;
  thickness: number;
  corolotMode: CorolotMode;
  activeSide: EditorSide;
  cutLineOffset: number;
  zoom: number;
  frontImageData: string | null;
  backImageData: string | null;
}

export interface HistoryEntry {
  state: Partial<EditorState>;
  canvasJSON: string;
  timestamp: number;
}
