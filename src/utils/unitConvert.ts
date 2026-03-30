import { MM_TO_PX } from '@/config/products';

const SCREEN_SCALE = 0.33;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX;
}

export function mmToScreenPx(mm: number): number {
  return mm * MM_TO_PX * SCREEN_SCALE;
}

export function screenPxToMm(px: number): number {
  return px / (MM_TO_PX * SCREEN_SCALE);
}
