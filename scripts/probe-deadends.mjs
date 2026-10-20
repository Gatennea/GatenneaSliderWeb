/**
 * 死局實測：把「普通打亂可能造出還原不了的局面」從推測變成數據。
 *
 * 做法（全程只用遊戲核心的 opt / try_move / commit_move 生成走法）：
 *   1. 從實心矩形出發，對**玩家實際可用的全部合法走法**做廣度優先搜尋，
 *      列出所有可達局面 R（平移歸一化去重；座標可以漂移，故只看相對形狀）。
 *   2. 若 BFS 自然耗盡（沒碰到上限），R 就是完整可達空間，後面的結論是嚴格的。
 *   3. 在 R 上把邊反過來，從所有「已還原矩形」做反向 BFS ⇒ 得到可解集合 S。
 *   4. R \ S 就是**絕對還原不了的局面**（在完整可達空間內窮盡過，不是抽樣、不是估計）。
 *   5. 順便統計：出度為 0 的「卡死」局面、不可逆邊的數量。
 *   6. 最後拿普通 shuffle 打出來的一批局面去對照：有多少比例剛好落在死局裡。
 *
 * 用法：node scripts/probe-deadends.mjs [m] [n] [step] [maxStates]
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';

const M = Number(process.argv[2] ?? 3);
const N = Number(process.argv[3] ?? 3);
const STEP = Number(process.argv[4] ?? 1);
const CAP = Number(process.argv[5] ?? 400000);
const WALL_MS = Number(process.argv[6] ?? 900000);

function rect(m, n) {
  const o = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) o.push([r, c]);
  return o;
}

/** 平移歸一化後再排序 → 形狀指紋（與絕對座標無關）。 */
function keyOf(coords) {
  let minR = Infinity;
  let minC = Infinity;
  for (const [r, c] of coords) {
    if (r < minR) minR = r;
    if (c < minC) minC = c;
  }
  return coords.map(([r, c]) => `${r - minR}:${c - minC}`).sort().join('|');
}

function parseKey(k) {
  return k.split('|').map((s) => s.split(':').map(Number));
}

function isRectShape(coords, m, n) {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  for (const [r, c] of coords) {
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;
  if (coords.length !== h * w) return false;
  return (h === m && w === n) || (h === n && w === m);
}

const g = new SliderMatrix(M, N);

/** 枚舉一個局面的所有後繼（去重過的形狀指紋）。 */
function successorsOf(coords) {
  g.restore({ blocks: coords });
  const b = g.get_boundaries();
  const gaps = [];
  for (let l = b.min_row; l < b.max_row; l++) if (g.is_valid_h_line(l)) gaps.push(['h', l]);
  for (let l = b.min_col; l < b.max_col; l++) if (g.is_valid_v_line(l)) gaps.push(['v', l]);

  const out = new Map(); // childKey -> {gapType,line,dir}
  const seenSel = new Set(); // 同一條縫上，選中集合相同的代表塊只試一次（等價，不漏）
  for (const [gapType, line] of gaps) {
    for (const [rr, cc] of coords) {
      const block = g.blocks.find((x) => x.row === rr && x.col === cc);
      if (!block) continue;
      g.opt(gapType, line, block);
      if (g.selected.size === 0) continue;
      const selKey = [...g.selected].map((x) => `${x.row}:${x.col}`).sort().join(',');
      if (seenSel.has(gapType + line + '|' + selKey)) continue;
      seenSel.add(gapType + line + '|' + selKey);
      for (const dir of gapType === 'h' ? ['a', 'd'] : ['w', 's']) {
        const fp = g.try_move(dir, stepArg);
        if (!fp) continue;
        const sel = new Set([...g.selected].map((x) => `${x.row}:${x.col}`));
        const landed = [];
        let i = 0;
        for (const [r, c] of coords) {
          landed.push(sel.has(`${r}:${c}`) ? [fp[i][0], fp[i][1]] : [r, c]);
          if (sel.has(`${r}:${c}`)) i++;
        }
        const k = keyOf(landed);
        if (!out.has(k)) out.set(k, { gapType, line, dir });
      }
    }
  }
  g.selected.clear();
  return out;
}

const stepArg = STEP;
const t0 = Date.now();
const start = keyOf(rect(M, N));
const keys = [start];
const index = new Map([[start, 0]]);
const fwd = [[]];
const rev = [[]];
const dist = [0];
let truncated = false;

for (let head = 0; head < keys.length; head++) {
  if (keys.length >= CAP) {
    truncated = true;
    console.log(`\n  （已達狀態上限 ${CAP}，停止展開）`);
    break;
  }
  if (Date.now() - t0 > WALL_MS) {
    truncated = true;
    console.log(`\n  （已達時間上限 ${(WALL_MS / 1000).toFixed(0)}s，停止展開）`);
    break;
  }
  const kids = successorsOf(parseKey(keys[head]));
  for (const k of kids.keys()) {
    let idx = index.get(k);
    if (idx === undefined) {
      idx = keys.length;
      keys.push(k);
      index.set(k, idx);
      fwd.push([]);
      rev.push([]);
      dist.push(dist[head] + 1);
    }
    fwd[head].push(idx);
    rev[idx].push(head);
  }
  if (head % 20000 === 0 && head > 0) {
    process.stdout.write(`  …已展開 ${head}/${keys.length} 個局面（${Date.now() - t0}ms）\r`);
  }
}

const total = keys.length;
console.log(`\n${M}×${N} step${STEP}：可達局面 ${total} 個${truncated ? `（已達上限 ${CAP}，搜尋被截斷，以下僅為下界）` : '（BFS 自然耗盡 ⇒ 這是完整可達空間）'}`);
console.log(`  展開耗時 ${Date.now() - t0}ms`);

// 已還原的矩形局面
const solvedIdx = [];
for (let i = 0; i < total; i++) if (isRectShape(parseKey(keys[i]), M, N)) solvedIdx.push(i);

// 反向 BFS：能走到矩形的局面 = 可解
const solvable = new Uint8Array(total);
const stack = [...solvedIdx];
for (const s of stack) solvable[s] = 1;
while (stack.length) {
  const cur = stack.pop();
  for (const p of rev[cur]) {
    if (!solvable[p]) {
      solvable[p] = 1;
      stack.push(p);
    }
  }
}

let dead = 0;
let stuck = 0;
const deadSamples = [];
for (let i = 0; i < total; i++) {
  if (solvable[i]) continue;
  dead++;
  if (fwd[i].length === 0) stuck++;
  if (deadSamples.length < 3) deadSamples.push(i);
}
console.log(`  其中「已還原矩形」局面 ${solvedIdx.length} 個`);
console.log(`  可解局面 ${total - dead} 個（${(((total - dead) / total) * 100).toFixed(2)}%）`);
console.log(`  ★ 還原不了的局面 ${dead} 個（${((dead / total) * 100).toFixed(2)}%）`);
console.log(`    其中「完全卡死、一步都走不了」的有 ${stuck} 個`);

for (const i of deadSamples) {
  g.restore({ blocks: parseKey(keys[i]) });
  console.log(
    `\n  死局範例 #${i}（出度 ${fwd[i].length}）：\n`
      + g.export_map().split('\n').map((s) => '    ' + s).join('\n'),
  );
}

// 距離分佈（對照原版引擎的上帝之數，用來確認兩邊規則口徑一致）
const hist = [];
for (let i = 0; i < total; i++) {
  hist[dist[i]] = (hist[dist[i]] ?? 0) + 1;
}
console.log(`\n  距離分佈（離矩形幾步）：${hist.join(', ')}`);
console.log(`  最遠距離 = ${Math.max(...dist)}（原版引擎稱「上帝之數」）`);

// D4 規範化後的形狀類數（原版引擎用 D4 規範化計數，方便直接對照）
function d4Canonical(coords) {
  let best = null;
  for (const mirror of [false, true]) {
    let cur = coords.map(([r, c]) => (mirror ? [r, -c] : [r, c]));
    for (let q = 0; q < 4; q++) {
      const k = keyOf(cur);
      if (best === null || k < best) best = k;
      cur = cur.map(([r, c]) => [c, -r]);
    }
  }
  return best;
}
const classes = new Set();
for (let i = 0; i < total; i++) classes.add(d4Canonical(parseKey(keys[i])));
console.log(`  D4 規範化後形狀類 = ${classes.size} 個（可與原版引擎的計數直接對照）`);

// 對照一：普通 shuffle 打出來的局面有多少落在死局裡（只在沒截斷時才嚴格）
if (!truncated) {
  let hit = 0;
  const samples = 400;
  for (let s = 0; s < samples; s++) {
    const gg = new SliderMatrix(M, N);
    gg.shuffle(M * N * 10, STEP);
    const k = keyOf(gg.blocks.map((b) => [b.row, b.col]));
    const idx = index.get(k);
    if (idx !== undefined && !solvable[idx]) hit++;
  }
  console.log(
    `\n  對照：普通 shuffle 打 ${samples} 局，有 ${hit} 局（${((hit / samples) * 100).toFixed(1)}%）落在死局集合裡`,
  );

  // 對照二：兩種打亂「離矩形多遠」——安全打亂只走可逆步，強度有沒有因此下降？
  const attempts = M * N * 10;
  const stat = (fn) => {
    const acc = [];
    for (let s = 0; s < 300; s++) {
      const gg = new SliderMatrix(M, N);
      fn(gg);
      const idx = index.get(keyOf(gg.blocks.map((b) => [b.row, b.col])));
      if (idx !== undefined) acc.push(dist[idx]);
    }
    acc.sort((a, b) => a - b);
    const mean = acc.reduce((a, b) => a + b, 0) / acc.length;
    return { mean, max: acc[acc.length - 1], median: acc[Math.floor(acc.length / 2)] };
  };
  const plain = stat((gg) => gg.shuffle(attempts, STEP));
  const safe = stat((gg) => gg.shuffle_safe(attempts, STEP));
  console.log(
    `  打亂強度（離矩形的 BFS 距離，越大越難）\n`
      + `    普通 shuffle  平均 ${plain.mean.toFixed(2)} 中位 ${plain.median} 最遠 ${plain.max}\n`
      + `    安全 shuffle  平均 ${safe.mean.toFixed(2)} 中位 ${safe.median} 最遠 ${safe.max}`,
  );
}
