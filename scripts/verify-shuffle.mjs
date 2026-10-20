/**
 * 驗證：安全打亂（shuffle_safe）出來的局面**一定可以還原**。
 *
 * 判定方式刻意不走 canUndoWith 那條捷徑，避免「自己證明自己」：
 * 這裡用**獨立的完備枚舉**列出一個局面的所有合法後繼（走法生成同樣呼叫遊戲核心的
 * opt / try_move / commit_move），然後檢查「前一個局面」是否在「後一個局面的後繼」裡。
 * 也就是說：每一步都能真的走回去 ⇒ 整條路徑反過來就是一條合法解法。
 *
 * 同時做對照組：把普通 shuffle() 打出來的局面拿去用同樣的方式檢查，看有多少步
 * 「連一步都走不回上一個局面」。
 *
 * ⚠️ 效力邊界（2026-10-18）：這裡的「一步走不回去」只是**不可逆的下界證據**，
 * 它**不等價於死局**（繞別條路通常仍走得回來，原版引擎測得 (4,4,2) 約 14% 的邊
 * 原路反推不合法，但真正永遠回不來的只有 7 條弧、9 個死局）。真正證明「打亂後的
 * 開局一定有解」的是 scripts/certify-shuffle.mjs（把反轉路徑真的走一遍）；
 * 死局有多稀少見 scripts/probe-deadends.mjs 與完整版 docs/math 的全圖復現。
 *
 * 用法：node scripts/verify-shuffle.mjs
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';

function keyOf(blocks) {
  return [...new Set(blocks.map(([r, c]) => `${r}:${c}`))].sort().join('|');
}

function hLines(g) {
  const b = g.get_boundaries();
  const o = [];
  for (let l = b.min_row; l < b.max_row; l++) if (g.is_valid_h_line(l)) o.push(l);
  return o;
}
function vLines(g) {
  const b = g.get_boundaries();
  const o = [];
  for (let l = b.min_col; l < b.max_col; l++) if (g.is_valid_v_line(l)) o.push(l);
  return o;
}

/**
 * next 能否一步走回 prev —— 窮舉 (縫隙線 × 代表塊 × 方向)。
 *
 * 刻意不用 canUndoWith 那條捷徑，避免「自己證明自己」；也刻意**不去重**，
 * 因為最初寫過按「線 + 選中分量」去重的版本，實測會漏邊、把可逆的一步誤報成
 * 不可逆（當初就是這樣誤以為安全打亂有 bug）。找到目標立即返回（不必列完）。
 */
function canStepBackTo(g, prevBlocks, nextBlocks, step) {
  const target = keyOf(prevBlocks);
  g.restore({ blocks: nextBlocks });
  const repPos = g.blocks.map((x) => [x.row, x.col]);
  for (const [rr, cc] of repPos) {
    for (const [gapType, lines] of [['h', hLines(g)], ['v', vLines(g)]]) {
      for (const line of lines) {
        const b = g.blocks.find((x) => x.row === rr && x.col === cc);
        if (!b) continue;
        for (const dir of gapType === 'h' ? ['a', 'd'] : ['w', 's']) {
          const before = g.snapshot();
          g.opt(gapType, line, b);
          const sel = [...g.selected];
          if (sel.length === 0) continue;
          const fp = g.try_move(dir, step);
          if (!fp) continue;
          g.commit_move(fp);
          const hit = keyOf(g.blocks.map((x) => [x.row, x.col])) === target;
          g.restore(before);
          if (hit) return true;
        }
      }
    }
  }
  return false;
}

function rect(m, n) {
  const o = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) o.push([r, c]);
  return o;
}

// ---------- 對照組：普通打亂的每一步是否都可逆 ----------
function probeNormalShuffle(m, n, step, attempts, samples, rng) {
  const g = new SliderMatrix(m, n);
  let irreversible = 0;
  let steps = 0;
  for (let s = 0; s < samples; s++) {
    g.restore({ blocks: rect(m, n) });
    // 逐步自己走，好檢查每一步（SliderMatrix.shuffle 內部不記錄路徑）
    for (let i = 0; i < attempts; i++) {
      const before = g.snapshot();
      const gaps = [];
      {
        const b = g.get_boundaries();
        for (let l = b.min_row + 1; l < b.max_row; l++) if (g.is_valid_h_line(l)) gaps.push(['h', l]);
        for (let l = b.min_col + 1; l < b.max_col; l++) if (g.is_valid_v_line(l)) gaps.push(['v', l]);
      }
      if (!gaps.length) break;
      const [gapType, line] = gaps[Math.floor(rng() * gaps.length) % gaps.length];
      const dir = gapType === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';
      const block = g.blocks[Math.floor(rng() * g.blocks.length) % g.blocks.length];
      g.opt(gapType, line, block);
      const fp = g.try_move(dir, step);
      if (!fp) {
        g.selected.clear();
        continue;
      }
      g.commit_move(fp);
      g.selected.clear();
      steps++;
      const after = g.blocks.map((x) => [x.row, x.col]);
      if (!canStepBackTo(g, before.blocks, after, step)) irreversible++;
    }
  }
  return { steps, irreversible };
}

// ---------- 實驗組：安全打亂 ----------
function probeSafeShuffle(m, n, step, attempts, samples, rng) {
  const g = new SliderMatrix(m, n);
  let badPairs = 0;
  let totalPairs = 0;
  for (let s = 0; s < samples; s++) {
    g.restore({ blocks: rect(m, n) });
    const path = [];
    g.shuffle_safe(attempts, step, rng, path);
    for (let i = 0; i + 1 < path.length; i++) {
      totalPairs++;
      if (!canStepBackTo(g, path[i].blocks, path[i + 1].blocks, step)) badPairs++;
    }
  }
  return { totalPairs, badPairs };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('每一步都用「獨立的完備枚舉」檢查能否走回上一個局面\n');
// 對照組要夠大才統計得出「普通打亂確實會踩到不可逆的一步」；
// 實驗組只要證明「沒出現例外」，量不必很大。
const scenarios = [
  { m: 3, n: 3, step: 1, attempts: 8, safeSamples: 12, normalSamples: 120 },
  { m: 4, n: 4, step: 2, attempts: 8, safeSamples: 12, normalSamples: 80 },
  { m: 6, n: 6, step: 2, attempts: 6, safeSamples: 6, normalSamples: 30 },
  // 貼近實際遊戲：main.ts 用 m*n*10 次嘗試，步數遠多於上面的小樣本
  { m: 4, n: 4, step: 2, attempts: 4 * 4 * 10, safeSamples: 3, normalSamples: 10 },
];

let failed = false;
let diagnosed = 0;
for (const sc of scenarios) {
  const rng = mulberry32(sc.m * 1000 + sc.step);
  const t0 = Date.now();
  const normal = probeNormalShuffle(sc.m, sc.n, sc.step, sc.attempts, sc.normalSamples, rng);
  const safe = probeSafeShuffle(sc.m, sc.n, sc.step, sc.attempts, sc.safeSamples, rng);
  const rateNormal = normal.steps ? ((normal.irreversible / normal.steps) * 100).toFixed(2) : '0';
  console.log(
    `${sc.m}×${sc.n} step${sc.step}  對照 ${sc.normalSamples} 局 / 實驗 ${sc.safeSamples} 局 × ${sc.attempts} 步   ${Date.now() - t0}ms`,
  );
  console.log(
    `  普通 shuffle：${normal.steps} 步中有 ${normal.irreversible} 步不可逆（${rateNormal}%）`
    + ` ← 這些就是「可能把玩家帶進死局」的來源`,
  );
  console.log(
    `  安全 shuffle_safe：${safe.totalPairs} 步中有 ${safe.badPairs} 步回不去`
    + `  ${safe.badPairs === 0 ? '✔ 全部可逆，打亂結果必定可還原' : '✘ 有例外！'}`,
  );
  console.log();
  if (safe.badPairs !== 0) failed = true;
}

if (failed) {
  console.error('[verify] 失敗：安全打亂產生了不可逆的一步');
  process.exit(1);
}
console.log('[verify] 通過：安全打亂的每一步都能走回去，故打亂出來的局面一定有解');
