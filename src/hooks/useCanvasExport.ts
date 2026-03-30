import * as fabric from 'fabric'

export function exportCanvasAsPNG(canvas: fabric.Canvas): string | null {
  if (!canvas) return null

  // Find product area bounds
  const productArea = canvas.getObjects().find(
    (o) => (o as fabric.FabricObject & { _editorType?: string })._editorType === 'product-area'
  )

  if (!productArea) return canvas.toDataURL({ format: 'png' })

  const left = productArea.left!
  const top = productArea.top!
  const width = productArea.width! * (productArea.scaleX ?? 1)
  const height = productArea.height! * (productArea.scaleY ?? 1)

  return canvas.toDataURL({
    format: 'png',
    left,
    top,
    width,
    height,
  })
}

export function downloadDataURL(dataURL: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  a.click()
}
