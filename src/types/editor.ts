import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from './product'

export type EditorSide = 'front' | 'back'

// 디자인 이미지 한 장 — 캔버스 위에서 개별 이동/크기/회전 가능
export interface DesignImage {
  id: string
  dataUrl: string
  name: string
  visible: boolean
  // 캔버스 픽셀 좌표 (center origin). 초기 마운트 시 캔버스 중앙으로 배치
  x: number
  y: number
  scaleX: number
  scaleY: number
  angle: number       // degrees
}

export const MAX_IMAGES_PER_SIDE = 10

export interface EditorState {
  productType: ProductType
  width: number
  height: number
  cornerRadius: number
  holeCount: number
  holePosition: HolePosition
  basePlateShape: BasePlateShape
  thickness: number
  corolotMode: CorolotMode
  activeSide: EditorSide
  cutLineOffset: number
  zoom: number
  // 양면 완전 독립: 앞/뒤 각각 디자인 이미지 그룹
  frontImages: DesignImage[]
  backImages: DesignImage[]
  cutLineSvgData: string | null
}
