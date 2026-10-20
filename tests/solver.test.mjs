/**
 * 求解器測試
 *
 * 最要緊的是「等價性」：求解器為了速度用了自己的整數集合表示法，
 * 必須證明它的走法語義和遊戲核心 SliderMatrix（opt → try_move → commit_move）
 * 逐格一致，否則解出來的東西在真實棋盤上根本推不動。
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import {
  enumerateMoves,
  stateFromBlocks,
  blocksOf,
  isSolvedState,
} from '../dist/solver/model.js';
import { findTargetWindow, detectHoles, solveByGather } from '../dist/solver/gather.js';
import { solve, stateScore, scoreBetter } from '../dist/solver/index.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const blocksKey = (blocks) =>
  blocks
    .map(([r, c]) => `${r}:${c}`)
    .sort()
    .join('|');

/** 用遊戲核心執行一個走法，回傳結果的 blocks key；不合法回 null。 */
function coreMove(blocks, m, n, step, gapType, line, seed, dir) {
  const g = new SliderMatrix(m, n);
  g.restore({ blocks: blocks.map(([r, c]) => [r, c]) });
  const blk = g.blocks.find((b) => b.row === seed[0] && b.col === seed[1]);
  if (!blk) return null;
  g.opt(gapType, line, blk);
  const fp = g.try_move(dir, step);
  if (!fp) return null;
  g.commit_move(fp);
  return blocksKey(g.blocks.map((b) => [b.row, b.col]));
}

/** 造一個打亂局面（從還原態出發，正向隨機走 N 次）。 */
function scramble(m, n, step, attempts, seed) {
  const g = new SliderMatrix(m, n);
  g.shuffle(attempts, step, mulberry32(seed));
  return g.blocks.map((b) => [b.row, b.col]);
}

export const cases = [
  {
    name: '走法枚舉與遊戲核心等價：結果逐格相同，且不遺漏走法',
    run() {
      let checked = 0;
      for (let s = 0; s < 12; s++) {
        const m = 4;
        const n = 4;
        const step = 2;
        const blocks = scramble(m, n, step, 6 + s, 1000 + s * 37);
        const state = stateFromBlocks(blocks);
        const moves = enumerateMoves(state, step);

        // (a) 求解器說合法的，核心也必須合法，且結果相同
        for (const mv of moves) {
          const a = mv.action;
          const key = coreMove(blocks, m, n, step, a.gapType, a.line, a.seed, a.dir);
          if (key === null) {
            throw new Error(
              `求解器認為合法但核心拒絕：${a.gapType}${a.line} ${a.side} ${a.dir}`,
            );
          }
          if (key !== blocksKey(blocksOf(mv.next))) {
            throw new Error(
              `走法結果與核心不一致：${a.gapType}${a.line} ${a.side} ${a.dir}`,
            );
          }
          checked++;
        }

        // (b) 核心能走的，求解器也必須枚舉出來（完整性）
        const coreKeys = new Set();
        const rs = blocks.map((b) => b[0]);
        const cs = blocks.map((b) => b[1]);
        const minR = Math.min(...rs);
        const maxR = Math.max(...rs);
        const minC = Math.min(...cs);
        const maxC = Math.max(...cs);
        for (let line = minR; line < maxR; line++) {
          for (const seed of blocks) {
            for (const dir of ['a', 'd']) {
              const k = coreMove(blocks, m, n, step, 'h', line, seed, dir);
              if (k) coreKeys.add(k);
            }
          }
        }
        for (let line = minC; line < maxC; line++) {
          for (const seed of blocks) {
            for (const dir of ['w', 's']) {
              const k = coreMove(blocks, m, n, step, 'v', line, seed, dir);
              if (k) coreKeys.add(k);
            }
          }
        }
        const solverKeys = new Set(moves.map((mv) => blocksKey(blocksOf(mv.next))));
        for (const k of coreKeys) {
          if (!solverKeys.has(k)) {
            throw new Error(`求解器漏了核心可達的走法結果：${k}`);
          }
        }
      }
      if (checked < 50) throw new Error(`比對樣本太少（${checked}），測試可疑`);
    },
  },

  {
    name: '目標窗口與洞檢測：已還原時重疊滿、無洞無凸起',
    run() {
      const m = 4;
      const n = 4;
      const blocks = [];
      for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) blocks.push([r, c]);
      const state = stateFromBlocks(blocks);
      const win = findTargetWindow(state, m, n);
      if (win.overlap !== m * n) {
        throw new Error(`已還原時重疊應為 ${m * n}，實為 ${win.overlap}`);
      }
      const rep = detectHoles(state, win, 2);
      if (rep.holes.length !== 0) throw new Error('已還原不應有洞');
      if (rep.dents.length !== 0) throw new Error('已還原不應有缺口');
      if (rep.protrusions.length !== 0) throw new Error('已還原不應有凸起');
      if (rep.emptyInWindow !== 0) throw new Error('已還原窗口內不應有空格');
    },
  },

  {
    name: '聚攏求解：4×4 step2 打亂後能還原（成功率門檻）',
    run() {
      const m = 4;
      const n = 4;
      const step = 2;
      const total = 10;
      let ok = 0;
      const lens = [];
      for (let i = 0; i < total; i++) {
        const blocks = scramble(m, n, step, 8, 500 + i * 131);
        if (isSolvedState(stateFromBlocks(blocks), m, n)) {
          ok++; // 打亂剛好沒動
          continue;
        }
        const res = solve(blocks, m, n, step, { restarts: 3, timeBudgetMs: 3000 });
        if (!res.solved) continue;
        // 用遊戲核心回放一遍，確認真的能還原
        const g = new SliderMatrix(m, n);
        g.restore({ blocks: blocks.map(([r, c]) => [r, c]) });
        for (const a of res.actions) {
          const blk = g.blocks.find((b) => b.row === a.seed[0] && b.col === a.seed[1]);
          if (!blk) throw new Error('回放時找不到代表塊');
          g.opt(a.gapType, a.line, blk);
          const fp = g.try_move(a.dir, step);
          if (!fp) throw new Error(`回放第 ${lens.length + 1} 步被核心拒絕`);
          g.commit_move(fp);
        }
        if (!g.is_solved()) throw new Error('回放後核心判定未還原');
        ok++;
        lens.push(res.steps);
      }
      const rate = ok / total;
      // 打亂可能走進死局（合法但永遠回不去），故不要求 100%
      if (rate < 0.6) {
        throw new Error(`成功率過低：${ok}/${total}（步數 ${lens.join(',')}）`);
      }
    },
  },

  {
    name: '聚攏求解：小謎題（3×3 step1 / 3×3 step2）也能還原',
    run() {
      const combos = [
        [3, 3, 1],
        [3, 3, 2],
      ];
      for (const [m, n, step] of combos) {
        let ok = 0;
        const total = 8;
        for (let i = 0; i < total; i++) {
          const blocks = scramble(m, n, step, 6, 900 + i * 71);
          const st = stateFromBlocks(blocks);
          if (isSolvedState(st, m, n)) {
            ok++;
            continue;
          }
          const res = solveByGather(st, m, n, step, {
            restarts: 3,
            timeBudgetMs: 2000,
            rng: mulberry32(7 + i),
          });
          if (res.solved) ok++;
        }
        if (ok < Math.ceil(total * 0.6)) {
          throw new Error(`${m}×${n} step${step} 成功率過低：${ok}/${total}`);
        }
      }
    },
  },

  {
    name: 'fill_partial 協議：全敗時的部分成果必須比初始局面好（解成啥樣是啥樣）',
    run() {
      const m = 5;
      const n = 5;
      const step = 2;
      let nonSolved = 0;
      let withPartial = 0;
      for (let i = 0; i < 12; i++) {
        const blocks = scramble(m, n, step, 40, 3000 + i * 17);
        const st = stateFromBlocks(blocks);
        if (isSolvedState(st, m, n)) continue;
        // 步數預算砍到 5：40 次重亂的 5×5 不可能在 5 步內全解 → 必定走全敗路徑
        const res = solve(blocks, m, n, step, { restarts: 1, maxSteps: 5, timeBudgetMs: 800 });
        if (res.solved) continue; // 個別種子碰巧解得出的，跳過（不影響協議檢驗）
        nonSolved++;
        if (res.actions.length === 0) continue; // 如實全敗（fill_fail），合法
        withPartial++;
        // 用遊戲核心回放：走法必須合法，且終局不能已經還原（協議自相矛盾）
        const g = new SliderMatrix(m, n);
        g.restore({ blocks: blocks.map(([r, c]) => [r, c]) });
        for (const a of res.actions) {
          const blk = g.blocks.find((b) => b.row === a.seed[0] && b.col === a.seed[1]);
          if (!blk) throw new Error('回放時找不到代表塊');
          g.opt(a.gapType, a.line, blk);
          const fp = g.try_move(a.dir, step);
          if (!fp) throw new Error('部分成果回放被核心拒絕');
          g.commit_move(fp);
        }
        if (g.is_solved()) throw new Error('標記為未全解卻還原了（協議自相矛盾）');
        // 關鍵不變式：部分成果回放後，聚攏度評分必須嚴格高於初始局面
        const before = stateScore(stateFromBlocks(blocks), m, n, step);
        const after = stateScore(
          stateFromBlocks(g.blocks.map((b) => [b.row, b.col])),
          m,
          n,
          step,
        );
        if (!scoreBetter(after, before)) {
          throw new Error('部分成果沒有讓局面變好：解不窮也別把局面搞更差');
        }
      }
      if (nonSolved === 0) throw new Error('未取到全敗樣本，測試無效');
      if (withPartial < 3) {
        throw new Error(`${nonSolved} 個全敗樣本裡只有 ${withPartial} 個給出部分成果，功能形同虛設`);
      }
    },
  },
];
