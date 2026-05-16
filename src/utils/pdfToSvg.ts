import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// PDF 파일의 첫 페이지를 SVG 문자열로 변환
export async function convertPdfFirstPageToSvg(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const opList = await page.getOperatorList()
  // @ts-expect-error - SVGGraphics는 legacy build의 namespace export
  const SVGGraphics = pdfjsLib.SVGGraphics
  if (!SVGGraphics) throw new Error('PDF를 SVG로 변환할 수 없습니다 (SVGGraphics 미지원)')
  const svgGfx = new SVGGraphics(page.commonObjs, page.objs)
  const svgEl = await svgGfx.getSVG(opList, viewport)
  // viewport mm 크기 힌트: PDF의 pt를 mm으로 환산 (1pt = 0.3528mm)
  const wMm = viewport.width * 0.3528
  const hMm = viewport.height * 0.3528
  if (svgEl instanceof Element) {
    svgEl.setAttribute('width', `${wMm.toFixed(2)}mm`)
    svgEl.setAttribute('height', `${hMm.toFixed(2)}mm`)
  }
  return new XMLSerializer().serializeToString(svgEl)
}
