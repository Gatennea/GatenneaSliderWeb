/**
 * 求解器對外入口
 *
 * 原版 solver/__init__.py 的 SOLVER_ALGORITHMS 註冊表已明確：IDA*／貪心爬山屬
 * 「早期搜索類算法，相對宏級流水線已非常低效，保留只為備查」；有效的是聚攏與
 * 填洞補缺。故網頁版只實這一條路線（src/solver/gather.ts）。
 *
 * 語義對照原版 solver 協定：
 *   solve(game, step, max_steps, cancel_check?, progress_callback?) -> list[action] | null
 *
 * 回傳協定對齊原版 auto_solve 的三態（solver/auto_solver.py）：
 *   solved=true                      全解，actions 是完整解法；
 *   solved=false 且 actions 非空     部分成果（fill_partial）：沒能全解，但這串走法
 *                                   回放後聚攏度嚴格高於初始局面——GUI 照樣播到斷點，
 *                                   「解成啥樣是啥樣」，玩家看斷點再自己接手；
 *   solved=false 且 actions 為空     全敗（fill_fail）：如實告知，不假裝有解。
 */

// 注意：本專案的打包器 scripts/bundle.mjs **不支援** `export { X } from './y.js'`
// 這種再導出寫法（它的正則只認以 `};` 結尾的 `export { X };`），寫了會讓 export
// 語句原樣殘留在 IIFE 產物裡 → app.js 直接 SyntaxError。
// 這裡一律改成「先 import，再 export { }」。
import {
  applyAction,
  enc,
  decRow,
  decCol,
  stateFromBlocks,
  blocksOf,
  enumerateMoves,
  isSolvedState,
  isInverseAction,
  type SolverAction,
  type State,
} from './model.js';
import {
  solveByGather,
  trimPath,
  findTargetWindow,
  detectHoles,
  overlapWith,
  bestMove,
  outsideDistance,
  stateScore,
  scoreBetter,
  type GatherOptions,
  type TargetWindow,
  type HoleReport,
  type GatherResult,
  type Score,
} from './gather.js';

// 再一個打包器坑：export 列表不能有尾隨逗號，否則 bundle.mjs 會切出空名字，
// 生成 `return { a, b, , c }` → SyntaxError。故以下一律不寫尾隨逗號。
export { findTargetWindow, detectHoles, overlapWith, solveByGather, bestMove, outsideDistance };
export { stateScore, scoreBetter };
export { enc, decRow, decCol, stateFromBlocks, blocksOf, enumerateMoves, applyAction, isSolvedState, isInverseAction };
export type { SolverAction, State, TargetWindow, HoleReport, GatherResult, GatherOptions, Score };

export interface SolveOptions extends GatherOptions {
  /** 失敗時換亂數種子重試的次數（聚攏爬山會卡在平原，重試常能救回來） */
  restarts?: number;
}

export interface SolveResult {
  /** 可回放的走法序列；每一個都對應 UI 的「選縫隙 → 點塊 → 推」 */
  actions: SolverAction[];
  solved: boolean;
  steps: number;
  attempts: number;
}

/** 可重現的亂數（mulberry32），讓重試之間彼此不同、且測試可預測。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 求解。回傳的 actions 可直接回放（見 main.ts 的 playSolverActions）。
 *
 * 全敗時不把手上的成果扔掉：對照原版 partial_better 規則（聚攏度高者勝、
 * 字典序 overlap→outside→holeCells→area→h），在多次重試裡擇優保留「回放後
 * 確實比初始局面好」的部分成果；沒有任何重試能改善局面時才如實回空。
 *
 * 注意：本遊戲存在「合法但無法還原」的死局，且爬山法不保證最優、也不保證成功；
 * 失敗時如實告訴玩家，不假裝有解，也不把亂踢出來的更差局面當成果。
 */
export function solve(
  blocks: readonly [number, number][],
  m: number,
  n: number,
  step: number,
  opts: SolveOptions = {},
): SolveResult {
  const restarts = opts.restarts ?? 3;
  const initial: State = stateFromBlocks(blocks);
  const initialScore = stateScore(initial, m, n, step);

  /** 全敗時擇優保留的部分成果（fill_partial） */
  let bestPartial: { actions: SolverAction[]; score: Score } | null = null;

  for (let attempt = 0; attempt < restarts; attempt++) {
    const res = solveByGather(initial, m, n, step, {
      ...opts,
      rng: opts.rng ?? mulberry32(0x9e3779b9 + attempt * 7919),
    });
    const trimmed = trimPath(res.actions);
    const solved = res.solved || (trimmed.length > 0 && endsSolved(initial, trimmed, m, n, step));
    if (solved) return { actions: trimmed, solved: true, steps: trimmed.length, attempts: attempt + 1 };

    // 未全解：只保留「回放後確實比初始局面好」的部分成果，
    // 否則寧可回空——把局面搞得更差的走法沒有任何播放價值。
    if (trimmed.length > 0) {
      const end = replayEnd(initial, trimmed, step);
      if (end) {
        const sc = stateScore(end, m, n, step);
        if (scoreBetter(sc, initialScore) && (!bestPartial || scoreBetter(sc, bestPartial.score))) {
          bestPartial = { actions: trimmed, score: sc };
        }
      }
    }
  }

  if (bestPartial) {
    return {
      actions: bestPartial.actions,
      solved: false,
      steps: bestPartial.actions.length,
      attempts: restarts,
    };
  }
  return { actions: [], solved: false, steps: 0, attempts: restarts };
}

/** 回放一遍；回傳終態，任一走法被拒回 null。 */
function replayEnd(initial: State, actions: SolverAction[], step: number): State | null {
  let cur: State = new Set(initial);
  for (const a of actions) {
    const next = applyAction(cur, a, step);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** 回放一遍確認結局真的還原（trimPath 之後重新驗證，避免剪出假解）。 */
function endsSolved(
  initial: State,
  actions: SolverAction[],
  m: number,
  n: number,
  step: number,
): boolean {
  const end = replayEnd(initial, actions, step);
  return end !== null && isSolvedState(end, m, n);
}

/** 求解結果的人話摘要（給 toast / 狀態列用）。 */
export function describeAction(a: SolverAction): string {
  const gap = a.gapType === 'h' ? '横缝' : '纵缝';
  const dirText: Record<string, string> = { w: '上', s: '下', a: '左', d: '右' };
  return `${gap}${a.line} · 往${dirText[a.dir]}推`;
}
