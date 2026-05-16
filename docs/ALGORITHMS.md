# 알고리즘 도움말

아크릴 제품 웹에디터에 사용된 기하/렌더링 알고리즘 모음. 위치는 모두 `src/` 하위 상대경로.

---

## 1. PDF → SVG 변환

**위치**: [`src/utils/pdfToSvg.ts`](../src/utils/pdfToSvg.ts)
**라이브러리**: `pdfjs-dist@3.11.174` (legacy build)

```
PDF ArrayBuffer
  → pdfjsLib.getDocument(...).promise
  → pdf.getPage(1)
  → page.getOperatorList()
  → SVGGraphics(page.commonObjs, page.objs).getSVG(opList, viewport)
  → XMLSerializer.serializeToString(svgEl)
```

- `viewport`의 width/height는 **PDF point 단위**. `pt × 0.3528 = mm`으로 환산해서 SVG의 `width`/`height` 속성에 mm 값을 부여 → 후속 svgParser가 mm 크기 자동 감지.
- v3의 `SVGGraphics`는 deprecated 경고를 출력하지만 path/curve를 정확히 SVG로 옮긴다. v4+는 SVGGraphics 제거됨.
- worker는 vite의 `?url` 접미사로 빌드 산출물 URL을 얻어 `GlobalWorkerOptions.workerSrc`에 지정.

---

## 2. SVG에서 외곽 polygon 추출

**위치**: [`src/utils/svgParser.ts`](../src/utils/svgParser.ts) — `parseSVGCutLine()`

1. `DOMParser`로 SVG 문자열 파싱, `parsererror` 확인.
2. `<svg>`의 `width`/`height` 속성을 `parseMmValue`로 해석. 단위 변환표:
   - `mm` × 1, `cm` × 10, `in` × 25.4, `pt` × 25.4/72, `pc` × 25.4/6, `px` × 25.4/96
3. **임시 SVG를 DOM에 attach**해야 `getBBox()` / `getPointAtLength()`가 동작 (분리된 노드는 NaN 반환). 화면 밖 좌표·opacity 0으로 숨김.
4. `path, rect, circle, ellipse, polygon, polyline` 중 **bounding box 면적이 가장 큰 shape** 선택.
5. polygon/polyline은 `.points`를 그대로 사용, 나머지는 `getTotalLength()` × `getPointAtLength(t)` 로 **균등 길이 sampling**(기본 200점).

> 부모 `<g transform="...">`은 적용되지 않는다(브라우저가 `getPointAtLength`에 반영 안 함). PDF→SVG 결과는 `<g transform="matrix(1 0 0 -1 0 H)">` y축 반전을 포함하는 경우가 많아 결과 polygon이 시각적 CW일 수 있다 → §6 정규화.

---

## 3. SVG → 화면 좌표 매핑

**위치**: [`FabricCanvas.tsx`](../src/components/canvas/FabricCanvas.tsx) — `svgPolyToScreen()`

bbox 중심을 캔버스 중심 `(cx, cy)`로 정렬하고, 한 축의 비율로 균일 scale(왜곡 방지).

```
scale = min(targetW / bbox.w, targetH / bbox.h)
dx = cx − (bbox.x + bbox.w/2) × scale
dy = cy − (bbox.y + bbox.h/2) × scale
p' = (p.x × scale + dx,  p.y × scale + dy)
```

- `targetW/H`는 store의 width/height(mm)를 `mmToScreenPx × zoom`으로 변환한 값.
- PDF mmSize가 sizeConstraint를 초과하면 [`ImageUploadPanel`](../src/components/panels/ImageUploadPanel.tsx)에서 **비율 유지 fit**(아래 §10).

---

## 4. Polygon Offset (평행 이동)

**위치**: [`src/utils/cutlineUtils.ts`](../src/utils/cutlineUtils.ts) — `offsetParallel()`
**winding-aware** 자체 구현 (Clipper2-js v1.2.4는 매끄러운 입력을 거친 출력으로 변환하는 결함이 있어 채택 보류).

### 4-1. winding 검출
표준 shoelace:
```
area = Σ (p_i.x × p_{i+1}.y − p_{i+1}.x × p_i.y)
isCW = area > 0    // 화면 좌표(y down) 기준
```

### 4-2. 각 점에서 outward normal
인접 두 변의 단위 normal을 winding sign에 맞춰 outward 방향으로 계산:
```
sign = isCW ? +1 : −1
n = ( sign × dy / |d|,  −sign × dx / |d| )
```
변의 normal이 거의 같은 방향이면(`dot > 0.9999`) 단순 평행 이동만.

### 4-3. 모서리 처리
변의 cross product 부호로 볼록/오목 판정:
- **볼록** (`isCW ? cross>0 : cross<0`): 두 normal 사이를 `π/12`(15°) 단위로 **호(arc)** 분할해서 점 채움.
- **오목**: `lineLineIntersect`로 두 offset 직선의 교점을 사용. 교점이 `|offset| × 4`보다 멀면 안전하게 중점으로 대체.

### 4-4. 후처리 (zigzag 제거)
1. `dedupClose(poly, 1.0)` — 인접 거리 1px 미만 점 합침. wrap-around(첫–끝) 거리도 검사.
2. `removeSelfIntersections(poly, 30)` — 큰 offset에서 발생하는 작은 loop 제거.

---

## 5. Self-intersection 제거

**위치**: [`cutlineUtils.ts`](../src/utils/cutlineUtils.ts) — `removeSelfIntersections()`

```
반복(최대 30회):
  비인접 두 변 (i, j) 쌍 스캔 → segmentIntersect가 점을 반환하면
    foundI=i, foundJ=j, foundPt=교점
    내부 구간 길이 = j − i, 외부(wrap) 구간 길이 = n − (j−i)
    짧은 쪽 구간의 점들을 foundPt 하나로 대체
교차 못 찾을 때까지
```

- 시간복잡도: 매 반복 O(n²). 300점에서 반복당 ~9만 비교.
- `segmentIntersect`는 분모 0 보호(`|det| < 1e-10`) + `eps=1e-6`로 endpoint 접촉 무시.

---

## 6. Polygon Winding 정규화 (자유형)

**위치**: [`FabricCanvas.tsx`](../src/components/canvas/FabricCanvas.tsx) — `polygonSignedSum()`

자유형 처리 시 screenPoly가 시각적 CW면 `.reverse()`로 CCW로 통일.

```
sum = Σ (p_{i+1}.x − p_i.x) × (p_{i+1}.y + p_i.y)
sum < 0  ⇒  CW (visual)
```

- CCW 정규화 후 자유형의 normal `(−ty/L, tx/L)`이 **항상 outward**.
- 정규화 안 하면 PDF에서 변환된 path(보통 CW)에서 고리가 cut-line 안쪽으로 들어간다.

---

## 7. 균등 Resample

**위치**: [`cutlineUtils.ts`](../src/utils/cutlineUtils.ts) — `resampleEvenly(points, count)`

누적 길이로 둘레 길이의 `i / count` 위치 점을 선형 보간:
```
cumLen[i+1] = cumLen[i] + |p_i − p_{i+1}|
target_i = (i / count) × total
seg에서 t = (target − cumLen[seg]) / (cumLen[seg+1] − cumLen[seg])
result_i = lerp(p_seg, p_{seg+1}, t)
```

자유형은 offset polygon을 300점으로 균등 분포 → 고리 스냅에 사용.

---

## 8. 칼선 Snap (드래그 시 boundary로 흡착)

### 8-1. 둥근 사각형 — `snapToRoundedRect`
**위치**: [`FabricCanvas.tsx`](../src/components/canvas/FabricCanvas.tsx)

좌표를 `(|x|, |y|)`로 1사분면 매핑한 뒤:
- **상/하 변 영역** (`ax ≤ innerW`): `(cx ± min(ax, innerW), cy ± (halfH + protrude))` — **perpendicular** protrude
- **좌/우 변 영역** (`ay ≤ innerH`): `(cx ± (halfW + protrude), cy ± min(ay, innerH))`
- **모서리 호 영역**: 호 중심 `(innerW, innerH)`에서 `(cornerR + protrude)` 반지름의 방향벡터로 투영
- **inner rect 안쪽 점**: `halfH − ay` vs `halfW − ax` 비교 → 가까운 변에 스냅 (오른쪽 변에서 안쪽으로 살짝 드래그할 때 상단으로 점프하는 버그 방지)

여기서 `innerW = halfW − cornerR`, `innerH = halfH − cornerR`.

### 8-2. 타원 — `snapToEllipse`
각도 기반 파라메트릭 점:
```
r = (rx × ry) / √((ry cosθ)² + (rx sinθ)²)
result = (cx + (r + protrude) cosθ,  cy + (r + protrude) sinθ)
```

### 8-3. 자유형 polygon — `snapToPolygon`
최근접 점을 brute force로 찾고, 그 점의 `(prev → next)` tangent에 수직인 outward로 `protrude` 이동.

---

## 9. 고리 초기 배치

### 9-1. `holePositions(cx, cy, halfW, halfH, count, position, protrude, cornerR)`
사각형/둥근 사각형용. 2개일 때 spacing은 **평면 변 안쪽**에서만:
```
flatHalfW = max(halfW − cornerR, 0)
spaceH = flatHalfW × 0.5
```
모서리 반경이 커도 고리가 둥근 코너 영역으로 밀려나지 않음.

### 9-2. `ellipseHolePositions(cx, cy, rx, ry, count, position, protrude)`
1개: 지정 방향 각도(`top → −π/2`, `right → 0`...).
2개: `base ± π/6` (±30°) — 타원 호 위 좌우 대칭.

### 9-3. `freeformHolePositions(poly, count, protrude)`
polygon 둘레를 `count + 1` 등분 → 각 등분점에서 tangent에 수직인 outward로 protrude.

---

## 10. PDF/SVG 크기를 제품 sizeConstraint에 fit

**위치**: [`ImageUploadPanel.tsx`](../src/components/panels/ImageUploadPanel.tsx) — `handleSvgFile`

```
scaleDown = min(maxW / mmW,  maxH / mmH,  1)
scaleUp   = max(minW / mmW,  minH / mmH,  1)
scale     = scaleDown < 1 ? scaleDown : scaleUp
fitW = clamp(round(mmW × scale × 2) / 2,  minW, maxW)
fitH = clamp(round(mmH × scale × 2) / 2,  minH, maxH)
```

- 큰 PDF는 비율을 유지하면서 max에 들어맞도록 축소.
- 작은 SVG는 min 이상으로 확대.
- 0.5mm 단위 반올림 → 사이드바 입력칸이 `90.4548…` 같이 길게 표시되는 문제 방지.

---

## 11. Canvas Z-order 정책

**위치**: [`FabricCanvas.tsx`](../src/components/canvas/FabricCanvas.tsx) — `reorder()`

명시적 배열로 매 reorder마다 결정적 순서를 강제:
```
Z_ORDER = ['product-area', 'user-image', 'hole', 'cut-line']
```
- **칼선은 언제나 최상위** (`evented: false`라 hole 드래그는 통과).
- 이전엔 `cut-line`과 `user-image`가 같은 루프에서 `bringObjectToFront`되어 마지막 처리된 게 위로 오는 버그(이미지 업로드 직후 vs 다른 조작 후 z-order가 뒤집힘) 발생.

---

## 12. 기타 안정화

- **`canvas.selection = false`**: 다중 hole이 ActiveSelection으로 묶여 snap 우회되는 문제 차단.
- **`canvasSize` 초기 `{0,0}` + 가드**: container 사이즈 미확정 상태에서 첫 프레임이 fallback 600×500으로 그려지고 ResizeObserver가 다시 그리는 동안 잠시 잘못된 좌표로 렌더되는 문제 차단.

---

## 데이터 흐름 요약

```
[자유형]                                            [사각형/원형]
SVG/PDF                                            (입력 없음 — store의 width/height 직접 사용)
  ↓ pdfToSvg / 텍스트 읽기
SVG 문자열
  ↓ svgParser.parseSVGCutLine
{polygon: 200점, bbox, mmSize}
  ↓ handleSvgFile에서 sizeConstraint fit
store.setSize(fitW, fitH) + store.setCutLineSvgData
  ↓ FabricCanvas useEffect
svgPolyToScreen → screenPoly                        rect/ellipse 도형 직접 생성
  ↓ winding 정규화 (CW면 reverse)
offsetParallel(screenPoly, off)                     ── 동일 ──
  → dedupClose → removeSelfIntersections
  ↓
fabric.Polygon (cut-line)                          fabric.Rect/Ellipse (cut-line)
  ↓ resampleEvenly(300)
store.setCutLinePolygon (snap 참조용)
  ↓
renderHoleGroups(positions, snapFn)
   ├ snapToPolygon (자유형)
   ├ snapToRoundedRect (사각형)
   └ snapToEllipse (원형)
  ↓
reorder(canvas) — Z_ORDER 적용
```
