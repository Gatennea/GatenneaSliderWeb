/**
 * 生成第 6 章（6.1~6.5）的關卡存檔。
 *
 * 原版 beginner_archive 只有 1~5 章，第 6 章在原版也是空的（標題/引導都是省略號）。
 * 本章主題是「更複雜的剛體凸起」—— 形狀有大塊座位一起伸出目標矩形之外。
 *
 * 生成方式：從已還原的 m×n 矩形出發做 K 次**隨機合法移動**，且**每一步都要求可逆**
 * （檢驗：在新局面上存在某個合法走法能走回原局面）。這樣把路徑反過來就是
 * 「起局 → … → 還原」的合法解法序列，**100% 保證有解**，完全不依賴求解器。
 *
 * 實測過另一條替代路線：用求解器（聚攏爬山）壓縮步數 —— 結果反而更差
 * （隨機 10 步的局面，求解器給出 29 / 117 / 31 步），因為爬山含大量「踢步」。
 * 所以解法直接用這條隨機可逆路徑本身，步數就是 K，乾淨且可控。
 *
 * 產出 scripts/ch6-levels.json（只含數據，交給 gen-tutorial-data.mjs 合併進
 * tutorialData.ts）。固定亂數種子，可重複 Bryan 重現同一批關卡。
 *
 * 前置：需要先 `npm run build`（本腳本從 dist/solver 載入走法生成，
 *       以確保與遊戲核心語義一致）。
 * 用法：node scripts/gen-ch6-levels.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  stateFromBlocks, blocksOf, enumerateMoves, isSolvedState,
} from '../dist/solver/model.js';

const root = path.resolve(import.meta.dirname, '..');
const outFile = path.join(root, 'scripts', 'ch6-levels.json');

for (const p of ['dist/solver/model.js']) {
  if (!fs.existsSync(path.join(root, p))) {
    console.error(`[ch6] 找不到 ${p}，請先執行 npm run build`);
    process.exit(1);
  }
}

// ---------- 工具 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sameState(a, b) {
  if (a.size !== b.size) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}

/** this→next 這一步是否可逆：next 中是否存在某個合法走法能走回 this。 */
function reversible(prev, next, step, limit = 60) {
  let n = 0;
  for (const mv of enumerateMoves(next, step)) {
    if (sameState(mv.next, prev)) return true;
    if (++n >= limit) break;
  }
  return false;
}

function rectBlocks(m, n) {
  const out = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) out.push([r, c]);
  return out;
}

/**
 * 從還原態隨機走 K 步，每步都要求可逆。
 * 回傳 states[0]=還原, states[K]=起局（尚未反轉）。
 *
 * 途中不得再度回到還原態：否則反轉後的解法會在中間就先還原、後面又走開，
 * 看起來像多餘的贅步（6.5 實測真的會發生）。
 */
function walkReversible(m, n, step, K, rng) {
  const states = [stateFromBlocks(rectBlocks(m, n))];
  for (let i = 0; i < K; i++) {
    const cur = states[states.length - 1];
    const moves = enumerateMoves(cur, step);
    // Fisher-Yates，避免每次都挑到同一區的走法
    const idx = moves.map((_, k) => k);
    for (let t = idx.length - 1; t > 0; t--) {
      const j = Math.floor(rng() * (t + 1));
      [idx[t], idx[j]] = [idx[j], idx[t]];
    }
    let pushed = false;
    for (const k of idx) {
      const mv = moves[k];
      if (isSolvedState(mv.next, m, n)) continue;
      if (reversible(cur, mv.next, step)) {
        states.push(mv.next);
        pushed = true;
        break;
      }
    }
    if (!pushed) break; // 該局面沒有任何可逆走法，提前收手
  }
  return states;
}

/** 起局在最佳 m×n 窗口下的凸起 / 洞 / 缺口統計（對照 gather.ts 的定義）。 */
function features(state, m, n) {
  const bs = blocksOf(state);
  const rows = bs.map((b) => b[0]);
  const cols = bs.map((b) => b[1]);
  const bw = { minR: Math.min(...rows), maxR: Math.max(...rows), minC: Math.min(...cols), maxC: Math.max(...cols) };
  const occ = new Set(bs.map((b) => `${b[0]}:${b[1]}`));

  // 目標窗口：讓重疊數最大的那個 m×n 矩形
  let best = null;
  for (let r0 = bw.minR - m; r0 <= bw.maxR; r0++) {
    for (let c0 = bw.minC - n; c0 <= bw.maxC; c0++) {
      let hit = 0;
      for (const [r, c] of bs) if (r >= r0 && r < r0 + m && c >= c0 && c < c0 + n) hit++;
      if (!best || hit > best.hit) best = { r0, c0, hit };
    }
  }
  const outside = m * n - best.hit;

  // 窗口內空格：洪水填充，觸邊=缺口(dent)、不觸邊=洞(hole)
  const empties = [];
  for (let r = best.r0; r < best.r0 + m; r++) {
    for (let c = best.c0; c < best.c0 + n; c++) {
      if (!occ.has(`${r}:${c}`)) empties.push([r, c]);
    }
  }
  const seen = new Set();
  let dents = 0;
  let holes = 0;
  let regions = 0;
  for (const [r0, c0] of empties) {
    const key = `${r0}:${c0}`;
    if (seen.has(key)) continue;
    const q = [[r0, c0]];
    seen.add(key);
    const group = [];
    let touchEdge = false;
    while (q.length) {
      const [r, c] = q.pop();
      group.push([r, c]);
      if (r === best.r0 || r === best.r0 + m - 1 || c === best.c0 || c === best.c0 + n - 1) touchEdge = true;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        const nk = `${nr}:${nc}`;
        if (nr < best.r0 || nr >= best.r0 + m || nc < best.c0 || nc >= best.c0 + n) continue;
        if (seen.has(nk) || occ.has(nk)) continue;
        seen.add(nk);
        q.push([nr, nc]);
      }
    }
    regions++;
    if (touchEdge) dents += group.length; else holes += group.length;
  }

  // 凸起被切成幾團（outside 塊的連通分量數）
  const outsideSet = new Set();
  for (const [r, c] of bs) {
    if (r < best.r0 || r >= best.r0 + m || c < best.c0 || c >= best.c0 + n) outsideSet.add(`${r}:${c}`);
  }
  const vseen = new Set();
  let bumps = 0;
  let bumpSpan = 0; // 各團外接矩形面積總和 → 用來算「緊湊度」
  for (const key of outsideSet) {
    if (vseen.has(key)) continue;
    bumps++;
    const q = [key];
    vseen.add(key);
    const group = [];
    while (q.length) {
      const [rs, cs] = q.pop().split(':').map(Number);
      group.push([rs, cs]);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${rs + dr}:${cs + dc}`;
        if (!outsideSet.has(nk) || vseen.has(nk)) continue;
        vseen.add(nk);
        q.push(nk);
      }
    }
    const gr = group.map((g) => g[0]);
    const gc = group.map((g) => g[1]);
    bumpSpan += (Math.max(...gr) - Math.min(...gr) + 1) * (Math.max(...gc) - Math.min(...gc) + 1);
  }
  // 緊湊度 = 凸起佔到自己外接矩形的比例：越接近 1 越像「一整塊剛體」，
  // 越低代表碎成一條歪歪扭扭的邊（那就只是 ”散開”，不是本章要的凸起）。
  const compact = bumpSpan > 0 ? outside / bumpSpan : 0;
  return {
    outside, bumps, holes, dents, regions, hit: best.hit, compact,
    spanR: bw.maxR - bw.minR + 1,
    spanC: bw.maxC - bw.minC + 1,
  };
}

/**
 * 契合「剛體凸起」主題的程度。
 *
 * 注意 outside 與「洞+缺口」是同一枚硬幣（總塊數守恆：outside ≡ 窗口內空格數），
 * 所以不能一味挑 outside 大的 —— 那只會選到「整體散開」的局面。
 * 本章要的是**伸出去的那幾坨是成塊的**，故主要看：
 *   每團平均格數（規模）、緊湊度（是否真的是一塊剛體）、團數不要太多。
 */
function themeScore(f, m, n) {
  const avgBump = f.bumps > 0 ? f.outside / f.bumps : 0;
  const cap = Math.floor(m * n * 0.3);
  let s = Math.min(avgBump, 5) * 2 + f.compact * 5 + Math.min(f.holes, 4) * 1.5;
  if (f.bumps > 3) s -= (f.bumps - 3) * 1.5; // 碎成一堆小凸起扣分
  if (f.outside > cap) s -= (f.outside - cap) * 0.6; // 整體散開扣分
  return s;
}

// ---------- 篇章設計 ----------
// K = 解法步數，遞增即難度遞增；m/n 由小到大。
const PLAN = [
  { id: '6.1', m: 6, n: 6, step: 2, K: 5, seedBase: 1001, candidates: 26, minOutside: 3, maxOverhang: 2,
    title: '认识刚体凸起', guidance: '整块一起伸到外面的部分叫「刚体凸起」——推的时候是好几格一起动，没法只挪其中一格。' },
  { id: '6.2', m: 6, n: 6, step: 2, K: 8, seedBase: 2002, candidates: 30, minOutside: 4, maxOverhang: 3,
    title: '两个方向的凸起', guidance: '横的竖的都有凸起时，先处理挡住另一个的那个，别急着把最近的推回去。' },
  { id: '6.3', m: 8, n: 8, step: 2, K: 8, seedBase: 3003, candidates: 26, minOutside: 5, maxOverhang: 3,
    title: '更长的凸起', guidance: '棋盘变大，凸起也更长。长条要顺着它伸出的方向整条推回去。' },
  { id: '6.4', m: 8, n: 8, step: 2, K: 11, seedBase: 4004, candidates: 34, minOutside: 5, maxOverhang: 3,
    title: '缺口连成一片', guidance: '左边缺了一大块、右边鼓出来一大坨——其实是同一件事：盯着那个最大的凸起整体推回去，缺口就跟着补上了。' },
  { id: '6.5', m: 8, n: 8, step: 2, K: 14, seedBase: 5005, candidates: 30, minOutside: 6, maxOverhang: 4,
    title: '综合练习', guidance: '凸起不止一个，而且互相牵制。先想清楚次序，别把刚推回去的又挤出来。' },
];

/** blocks（絕對座標）→ {matrix, bounds}，與 GameStore.deserialize 相容。 */
function toSnapshot(blocks) {
  const rows = blocks.map((b) => b[0]);
  const cols = blocks.map((b) => b[1]);
  const bounds = {
    min_row: Math.min(...rows), max_row: Math.max(...rows),
    min_col: Math.min(...cols), max_col: Math.max(...cols),
  };
  const h = bounds.max_row - bounds.min_row + 1;
  const w = bounds.max_col - bounds.min_col + 1;
  const matrix = Array.from({ length: h }, () => new Array(w).fill(0));
  for (const [r, c] of blocks) matrix[r - bounds.min_row][c - bounds.min_col] = 1;
  return { matrix, bounds };
}

// ---------- 自校驗（在寫檔前攔下任何不合法） ----------
/** 相鄰兩個局面是否只差一個合法走法（用遊戲一致的走法枚舉核對）。 */
function differByOneMove(a, b, step) {
  for (const mv of enumerateMoves(a, step)) {
    if (sameState(mv.next, b)) return true;
  }
  return false;
}

function verify(m, n, step, snapshots, expectSteps) {
  const errs = [];
  // 快照數 = 解法步數 + 1（含起局與還原態）
  if (snapshots.length !== expectSteps + 1) errs.push(`快照數 ${snapshots.length} ≠ ${expectSteps + 1}`);

  const states = snapshots.map((s) => {
    const bs = [];
    for (let r = 0; r < s.matrix.length; r++) {
      for (let c = 0; c < s.matrix[r].length; c++) {
        if (s.matrix[r][c] === 1) bs.push([s.bounds.min_row + r, s.bounds.min_col + c]);
      }
    }
    return { state: stateFromBlocks(bs), blocks: bs };
  });

  // 每快照塊數必須 == m*n
  states.forEach((st, i) => {
    if (st.blocks.length !== m * n) errs.push(`快照${i} 塊數 ${st.blocks.length} ≠ ${m * n}`);
  });

  // 相鄰快照必須只差一個合法走法
  for (let i = 0; i + 1 < states.length; i++) {
    if (!differByOneMove(states[i].state, states[i + 1].state, step)) {
      errs.push(`快照${i}→${i + 1} 不是一個合法走法`);
    }
  }

  // 起局亂、末態已還原
  if (isSolvedState(states[0].state, m, n)) errs.push('起局已經是還原態');
  if (!isSolvedState(states[states.length - 1].state, m, n)) errs.push('末態不是還原態');

  // 中間態不應提前出現還原（否則後面步驟多餘）
  for (let i = 1; i + 1 < states.length; i++) {
    if (isSolvedState(states[i].state, m, n)) errs.push(`快照${i} 中途就已還原`);
  }
  return errs;
}

// ---------- 主流程 ----------
const archives = {};
const metas = {};
const report = [];

for (const cfg of PLAN) {
  const { id, m, n, step, K, seedBase, candidates, minOutside } = cfg;
  const t0 = Date.now();
  let best = null;

  for (let t = 0; t < candidates; t++) {
    const rng = mulberry32(seedBase + t * 7919);
    const fwd = walkReversible(m, n, step, K, rng);
    if (fwd.length !== K + 1) continue; // 沒走滿 K 步，跳過
    const startState = fwd[fwd.length - 1];
    const f = features(startState, m, n);
    if (f.outside < minOutside) continue; // 凸起不夠明顯，不符合本章主題
    // 硬約束：整體只能比目標矩形大一點點。否則 K 一大，隨機遊走會把形狀甩得
    // 整個扭曲（實測 6.4/6.5 一度幾乎所有塊都跑到窗口外），那就不是「凸起」
    // 而是「散架」了。限制包圍盒 → 凸起只能貼著邊整塊鼓出來。
    if (f.spanR > m + cfg.maxOverhang || f.spanC > n + cfg.maxOverhang) continue;
    const sc = themeScore(f, m, n);
    if (!best || sc > best.score) best = { score: sc, fwd, f, seed: seedBase + t * 7919 };
  }

  if (!best) {
    console.error(`[ch6] ${id} 找不到符合條件的局面（${candidates} 個候選都失敗）`);
    process.exit(1);
  }

  // 反轉：還原態 → 起局  改為  起局 → … → 還原態
  const ordered = [...best.fwd].reverse();
  const snapshots = ordered.map((st) => toSnapshot(blocksOf(st)));

  const errs = verify(m, n, step, snapshots, K);
  if (errs.length) {
    console.error(`[ch6] ${id} 自校驗失敗：\n  ${errs.join('\n  ')}`);
    process.exit(1);
  }

  archives[id] = {
    version: 1,
    puzzle: { m, n, step },
    step_count: K,
    history: { history_index: K, snapshots },
  };
  metas[id] = { title: cfg.title, guidance: cfg.guidance };

  const f = best.f;
  report.push(
    `${id}  ${m}×${n} step${step}  解法${K}步  `
    + `凸起${f.outside}格/${f.bumps}团  紧凑度${f.compact.toFixed(2)}  洞${f.holes}  缺口${f.dents}  `
    + `seed=${best.seed}  ${Date.now() - t0}ms`,
  );
}

fs.writeFileSync(
  outFile,
  `${JSON.stringify({ generatedBy: 'scripts/gen-ch6-levels.mjs', chapters: Object.keys(archives), metas, archives }, null, 2)}\n`,
  'utf8',
);

console.log('[ch6] 已生成', path.relative(root, outFile));
for (const line of report) console.log('  ', line);
console.log(`[ch6] 全部 ${report.length} 關自校驗通過（每快照為 m×n 塊、相鄰只差一個合法走法、末態已還原）`);
