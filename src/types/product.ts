export type ProductType = 'keyring' | 'corolot' | 'standee' | 'magnet-badge';

export type BasePlateShape = 'circle' | 'rectangle' | 'square' | 'hexagon';

export type CorolotMode = 'same-image' | 'different-image';

export type HolePosition = 'top' | 'top-left' | 'top-right' | 'bottom' | 'left' | 'right';

export interface SizeConstraint {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface ProductConfig {
  type: ProductType;
  nameKo: string;
  nameEn: string;
  nameJa: string;
  description: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  sizeConstraint: SizeConstraint;
  hasCornerRadius: boolean;
  hasHole: boolean;
  hasBasePlate: boolean;
  hasThickness: boolean;
  hasDualSide: boolean;
  supportedThickness?: number[];
  supportedBasePlates?: BasePlateShape[];
  // 본체 두께 (mm) — supportedThickness 없을 때 사용
  defaultThickness: number;
  // 라미네이트(합지) 옵션 — 뒷면에 추가 acrylic layer
  hasLaminate?: boolean;
  laminateThickness?: number; // mm — hasLaminate일 때 적용
}
