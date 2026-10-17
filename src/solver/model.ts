/**
 * 求解器 · 狀態表示與走法生成
 * 對照原版 solver/state.py（狀態編碼/特徵）與 solver/actions.py（動作枚舉/執行）。
 *
 * 兩點刻意偏離原版，都是為了「更強」而非不同：
 *  1. 原版每個 (縫隙, 側) 只取 side_blocks[0] 作代表塊，同側若有多個連通分量會漏走法；
 *     這裡枚舉同側的**每一個連通分量**，解得出來的局面只會更多。
 *  2. 狀態用「編碼後的整數集合」而非 Block 物件陣列，搜尋時免掉大量物件配置。
 *     走法語義與 SliderMatrix.opt/try_move/commit_move 完全一致，由 tests/solver.test.mjs
 *     做等價性比對（同一局面、同一走法，兩邊結果必須逐格相同）。
 */

import { DIRECTION_DELTA, type Direction, type GapType } from '../core/rules.js';

/** 側：h 縫 → above/below；v 縫 → left/right。above/left 含線，below/right 不含。 */
export type Side = 'above' | 'below' | 'left' | 'right';

/**
 * 一個走法。欄位刻意對齊 UI 的三步操作：
 *   選縫隙(gapType, line) → 點塊(seed) → 往 dir 推
 * 因此求解結果可以直接回放給玩家看，不需要任何轉換。
 */
export interface SolverAction {
  gapType: GapType;
  line: number;
  side: Side;
  /** 代表塊位置（UI selectBlock 用）；必須在該分量內 */
  seed: [number, number];
  dir: Direction;
}

// ---------- 座標編碼 ----------
// 滑塊可能被推出原本的 m×n 範圍（缺口外滑），座標可為負，故整體加偏移後打包成一個整數。
const SHIFT = 11;
const SPAN = 1 << SHIFT; // 2048
const MASK = SPAN - 1;
const OFF = 1 << 10; // 1024 → 允許 r/c ∈ [-1024, 1023]

export function enc(r: number, c: number): number {
  return ((r + OFF) << SHIFT) | (c + OFF);
}
export function decRow(p: number): number {
  return (p >> SHIFT) - OFF;
}
export function decCol(p: number): number {
  return (p & MASK) - OFF;
}

/** 棋盤狀態 = 滑塊位置集合。走法一律回傳新集合（不可變），搜尋時免快照/還原。 */
export type State = Set<number>;

export function stateFromBlocks(blocks: readonly [number, number][]): State {
  const s: State = new Set();
  for (const [r, c] of blocks) s.add(enc(r, c));
  return s;
}

export function blocksOf(state: State): [number, number][] {
  const out: [number, number][] = [];
  for (const p of state) out.push([decRow(p), decCol(p)]);
  return out;
}

export interface Bounds {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

export function boundsOf(state: State): Bounds {
  let minR = Infinity;
  let maxR = -Infinity;
  let minC = Infinity;
  let maxC = -Infinity;
  for (const p of state) {
    const r = decRow(p);
    const c = decCol(p);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC };
}

/** 包圍盒面積（G1 階段目標就是讓它等於 m*n）。 */
export function bbArea(state: State): number {
  const b = boundsOf(state);
  return (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
}

/**
 * 是否已還原：包圍盒恰為 m×n（或 n×m）且盒內填滿。
 * 對照 SliderMatrix.is_solved 的「實心矩形」口徑（solutionMask 屬創造模式，求解器不處理）。
 */
export function isSolvedState(state: State, m: number, n: number): boolean {
  if (state.size !== m * n) return false;
  const b = boundsOf(state);
  const h = b.maxR - b.minR + 1;
  const w = b.maxC - b.minC + 1;
  if (!((h === m && w === n) || (h === n && w === m))) return false;
  for (let r = b.minR; r <= b.maxR; r++) {
    for (let c = b.minC; c <= b.maxC; c++) {
      if (!state.has(enc(r, c))) return false;
    }
  }
  return true;
}

// ---------- 連通性 ----------
function isSingleConnected(set: State): boolean {
  if (set.size === 0) return true;
  const start = set.values().next().value as number;
  const seen: State = new Set([start]);
  const stack: number[] = [start];
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const r = decRow(p);
    const c = decCol(p);
    const nbs = [enc(r - 1, c), enc(r + 1, c), enc(r, c - 1), enc(r, c + 1)];
    for (const nb of nbs) {
      if (set.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === set.size;
}

/**
 * 縫某一側的所有連通分量。
 * 同一側內不會跨線，故直接在該側集合上做 BFS 即等價於 SliderMatrix.opt 的結果。
 */
function componentsOnSide(state: State, gapType: GapType, line: number, side: Side): number[][] {
  const onSide: State = new Set();
  for (const p of state) {
    const r = decRow(p);
    const c = decCol(p);
    const ok =
      gapType === 'h'
        ? side === 'above'
          ? r <= line
          : r > line
        : side === 'left'
          ? c <= line
          : c > line;
    if (ok) onSide.add(p);
  }

  const seen: State = new Set();
  const comps: number[][] = [];
  for (const p0 of onSide) {
    if (seen.has(p0)) continue;
    const comp: number[] = [];
    const stack: number[] = [p0];
    while (stack.length > 0) {
      const p = stack.pop() as number;
      if (seen.has(p)) continue;
      seen.add(p);
      comp.push(p);
      const r = decRow(p);
      const c = decCol(p);
      const nbs = [enc(r - 1, c), enc(r + 1, c), enc(r, c - 1), enc(r, c + 1)];
      for (const nb of nbs) {
        if (onSide.has(nb) && !seen.has(nb)) stack.push(nb);
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * 嘗試把 comp 往 dir 推 step 格。逐步驗證（碰撞 + 全體單一連通），
 * 任一步不合法就回 null —— 與 SliderMatrix.try_move 的逐步語義一致。
 */
export function tryMove(
  state: State,
  comp: readonly number[],
  dir: Direction,
  step: number,
): State | null {
  const delta = DIRECTION_DELTA[dir];
  const rest: State = new Set();
  const compSet: State = new Set(comp);
  for (const p of state) if (!compSet.has(p)) rest.add(p);

  let cur: number[] = comp.slice();
  for (let k = 0; k < step; k++) {
    const next: number[] = cur.map((p) => enc(decRow(p) + delta[0], decCol(p) + delta[1]));
    const nextSet: State = new Set(next);
    for (const p of nextSet) if (rest.has(p)) return null; // 碰撞
    const union: State = new Set(rest);
    for (const p of nextSet) union.add(p);
    if (!isSingleConnected(union)) return null;
    cur = next;
  }

  const out: State = new Set(rest);
  for (const p of cur) out.add(p);
  return out;
}

/** 一次合法走法（含走完後的局面，避免搜尋時重算）。 */
export interface Move {
  action: SolverAction;
  next: State;
}

/**
 * 枚舉當前局面所有合法走法。
 * 縫隙範圍對照 SliderMatrix.is_valid_h_line / is_valid_v_line（含下邊界、不含上邊界）。
 */
export function enumerateMoves(state: State, step: number): Move[] {
  const b = boundsOf(state);
  const out: Move[] = [];

  const sidesFor = (gapType: GapType): [Side, Side] =>
    gapType === 'h' ? ['above', 'below'] : ['left', 'right'];
  const dirsFor = (gapType: GapType): [Direction, Direction] =>
    gapType === 'h' ? ['a', 'd'] : ['w', 's'];

  // h 縫：line ∈ [minR, maxR)，只能左右推
  for (let line = b.minR; line < b.maxR; line++) {
    for (const side of sidesFor('h')) {
      for (const comp of componentsOnSide(state, 'h', line, side)) {
        for (const dir of dirsFor('h')) {
          const next = tryMove(state, comp, dir, step);
          if (!next) continue;
          out.push({
            action: {
              gapType: 'h',
              line,
              side,
              seed: [decRow(comp[0]), decCol(comp[0])],
              dir,
            },
            next,
          });
        }
      }
    }
  }

  // v 縫：line ∈ [minC, maxC)，只能上下推
  for (let line = b.minC; line < b.maxC; line++) {
    for (const side of sidesFor('v')) {
      for (const comp of componentsOnSide(state, 'v', line, side)) {
        for (const dir of dirsFor('v')) {
          const next = tryMove(state, comp, dir, step);
          if (!next) continue;
          out.push({
            action: {
              gapType: 'v',
              line,
              side,
              seed: [decRow(comp[0]), decCol(comp[0])],
              dir,
            },
            next,
          });
        }
      }
    }
  }

  return out;
}

/**
 * 在狀態上執行一個走法：找出 seed 所屬的同側連通分量，再推 step 格。
 * 供求解器驗證與預覽使用（不依賴 SliderMatrix，純集合運算）。
 */
export function applyAction(state: State, action: SolverAction, step: number): State | null {
  const comps = componentsOnSide(state, action.gapType, action.line, action.side);
  const seedPos = enc(action.seed[0], action.seed[1]);
  for (const comp of comps) {
    if (comp.indexOf(seedPos) >= 0) return tryMove(state, comp, action.dir, step);
  }
  return null;
}

/**
 * 置換表用的狀態鍵：平移歸一化（減去包圍盒左上角）。
 * 對照原版 state_key —— 形狀相同、位置不同視為同一狀態。
 */
export function stateKey(state: State): string {
  const b = boundsOf(state);
  const norm: number[] = [];
  for (const p of state) norm.push(enc(decRow(p) - b.minR, decCol(p) - b.minC));
  norm.sort((x, y) => x - y);
  return norm.join(',');
}

/** 兩個走法是否互為逆操作（同縫隙、同側、方向相反）—— 用來禁止原地來回。 */
export function isInverseAction(a: SolverAction, b: SolverAction): boolean {
  if (a.gapType !== b.gapType || a.line !== b.line || a.side !== b.side) return false;
  const pairs: [Direction, Direction][] = [
    ['w', 's'],
    ['s', 'w'],
    ['a', 'd'],
    ['d', 'a'],
  ];
  return pairs.some(([x, y]) => a.dir === x && b.dir === y);
}

// ---------- 啟發式（對照 solver/heuristic.py） ----------
function scoreParts(state: State, m: number, n: number): { fillRate: number; aspectError: number } {
  const b = boundsOf(state);
  const H = b.maxR - b.minR + 1;
  const W = b.maxC - b.minC + 1;
  const K = m * n;
  const area = H * W;
  const fillRate = area > 0 ? K / area : 0;

  const minDim = Math.min(m, n);
  const maxDim = Math.max(m, n);
  const targetRatio = minDim > 0 ? maxDim / minDim : 1;
  const minHW = Math.min(H, W);
  const maxHW = Math.max(H, W);
  const currentRatio = minHW > 0 ? maxHW / minHW : 1;
  const maxRatio = Math.max(currentRatio, targetRatio);
  const aspectError = maxRatio > 0 ? Math.abs(currentRatio - targetRatio) / maxRatio : 0;

  return { fillRate, aspectError };
}

/** 標準啟發：Score = 0.5·fill_rate + 0.5·(1−aspect_error)，h = 1 − Score ∈ [0,1)。 */
export function heuristic(state: State, m: number, n: number): number {
  if (isSolvedState(state, m, n)) return 0;
  const { fillRate, aspectError } = scoreParts(state, m, n);
  return 1 - (0.5 * fillRate + 0.5 * (1 - aspectError));
}

/** 快速模式啟發：加重聚攏權重（0.7 / 0.3），更快找到可行解，不保證最優。 */
export function fastHeuristic(state: State, m: number, n: number): number {
  if (isSolvedState(state, m, n)) return 0;
  const { fillRate, aspectError } = scoreParts(state, m, n);
  return 1 - (0.7 * fillRate + 0.3 * (1 - aspectError));
}

/** G1（聚攏）階段專用：只看填充率。 */
export function fillRateHeuristic(state: State, m: number, n: number): number {
  if (state.size === 0) return 1;
  const { fillRate } = scoreParts(state, m, n);
  return 1 - fillRate;
}

/** G1 階段目標：包圍盒面積 == m*n（已是實心，但長寬比可能不對）。 */
export function isGathered(state: State, m: number, n: number): boolean {
  return state.size > 0 && bbArea(state) === m * n;
}
