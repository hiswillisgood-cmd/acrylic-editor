import type { ProductConfig } from '@/types/product';

export const PRODUCTS: Record<string, ProductConfig> = {
  keyring: {
    type: 'keyring',
    nameKo: '아크릴 키링',
    nameEn: 'Acrylic Keyring',
    nameJa: 'アクリルキーリング',
    description: '나만의 아크릴 키링을 만들어보세요',
    icon: '🔑',
    defaultWidth: 50,
    defaultHeight: 50,
    sizeConstraint: { minWidth: 20, maxWidth: 100, minHeight: 20, maxHeight: 100 },
    hasCornerRadius: true,
    hasHole: true,
    hasBasePlate: false,
    hasThickness: false,
    hasDualSide: false,
  },
  corolot: {
    type: 'corolot',
    nameKo: '코롯토 (양면)',
    nameEn: 'Corolot (Double-sided)',
    nameJa: 'コロット（両面）',
    description: '양면 아크릴 코롯토를 제작하세요',
    icon: '🐧',
    defaultWidth: 60,
    defaultHeight: 70,
    sizeConstraint: { minWidth: 30, maxWidth: 100, minHeight: 30, maxHeight: 100 },
    hasCornerRadius: true,
    hasHole: true,
    hasBasePlate: false,
    hasThickness: false,
    hasDualSide: true,
  },
  standee: {
    type: 'standee',
    nameKo: '아크릴 등신대',
    nameEn: 'Acrylic Standee',
    nameJa: 'アクリルスタンド',
    description: '아크릴 등신대를 제작하세요',
    icon: '🧍',
    defaultWidth: 70,
    defaultHeight: 100,
    sizeConstraint: { minWidth: 30, maxWidth: 200, minHeight: 30, maxHeight: 300 },
    hasCornerRadius: false,
    hasHole: false,
    hasBasePlate: true,
    hasThickness: true,
    hasDualSide: false,
    supportedThickness: [15, 20, 30],
    supportedBasePlates: ['circle', 'rectangle', 'square', 'hexagon'],
  },
  'magnet-badge': {
    type: 'magnet-badge',
    nameKo: '마그넷 / 뱃지',
    nameEn: 'Magnet / Badge',
    nameJa: 'マグネット / バッジ',
    description: '아크릴 마그넷 또는 뱃지를 만들어보세요',
    icon: '🧲',
    defaultWidth: 50,
    defaultHeight: 50,
    sizeConstraint: { minWidth: 20, maxWidth: 80, minHeight: 20, maxHeight: 80 },
    hasCornerRadius: true,
    hasHole: false,
    hasBasePlate: false,
    hasThickness: false,
    hasDualSide: false,
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);

export const DPI = 300;
export const MM_TO_PX = DPI / 25.4; // ~11.81
export const DEFAULT_CUT_LINE_OFFSET = 2; // 2mm
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
