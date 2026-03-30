import type * as fabric from 'fabric'

let _canvas: fabric.Canvas | null = null

export function setCanvasRef(canvas: fabric.Canvas | null) {
  _canvas = canvas
}

export function getCanvasRef(): fabric.Canvas | null {
  return _canvas
}
