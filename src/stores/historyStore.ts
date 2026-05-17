import { create } from 'zustand'
import type { DesignImage, EditorSide } from '@/types/editor'
import type { ProductType, BasePlateShape, CorolotMode, HolePosition } from '@/types/product'
import type { CutShape } from './editorStore'

// 디자인 의도 있는 필드만 snapshot — zoom, selection 등 일시 상태 제외
export interface HistorySnapshot {
  productType: ProductType
  cutShape: CutShape
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
  frontImages: DesignImage[]
  backImages: DesignImage[]
  cutLineSvgData: string | null
}

interface HistoryStore {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  // 현재 state를 past에 push (변경 직전 호출). future는 비움
  record: (snapshot: HistorySnapshot) => void
  // 가장 최근 past 반환 + 현재 snapshot을 future로 이동
  undo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null
  redo: (currentSnapshot: HistorySnapshot) => HistorySnapshot | null
  clear: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

const MAX_HISTORY = 50

// 두 snapshot이 같은지 얕은 비교 — 중복 push 방지용
function snapshotsEqual(a: HistorySnapshot, b: HistorySnapshot): boolean {
  if (a.productType !== b.productType) return false
  if (a.cutShape !== b.cutShape) return false
  if (a.width !== b.width || a.height !== b.height) return false
  if (a.cornerRadius !== b.cornerRadius) return false
  if (a.holeCount !== b.holeCount || a.holePosition !== b.holePosition) return false
  if (a.basePlateShape !== b.basePlateShape) return false
  if (a.thickness !== b.thickness) return false
  if (a.corolotMode !== b.corolotMode) return false
  if (a.activeSide !== b.activeSide) return false
  if (a.cutLineOffset !== b.cutLineOffset) return false
  if (a.cutLineSvgData !== b.cutLineSvgData) return false
  if (a.frontImages.length !== b.frontImages.length) return false
  if (a.backImages.length !== b.backImages.length) return false
  return true
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  record: (snapshot) => set((s) => {
    const last = s.past[s.past.length - 1]
    if (last && snapshotsEqual(last, snapshot)) return s
    const past = [...s.past, snapshot]
    if (past.length > MAX_HISTORY) past.shift()
    return { past, future: [] }
  }),
  undo: (currentSnapshot) => {
    const { past, future } = get()
    if (past.length === 0) return null
    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [currentSnapshot, ...future].slice(0, MAX_HISTORY),
    })
    return prev
  },
  redo: (currentSnapshot) => {
    const { past, future } = get()
    if (future.length === 0) return null
    const next = future[0]
    set({
      past: [...past, currentSnapshot].slice(-MAX_HISTORY),
      future: future.slice(1),
    })
    return next
  },
  clear: () => set({ past: [], future: [] }),
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
