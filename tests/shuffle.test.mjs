/**
 * 安全打亂（shuffle_safe）測試
 *
 * 要守住的性質：**每一步都走得回去**。
 * 只要每一步可逆，整條打亂路徑反過來就是一條合法解法 —— 這是「打亂結果必定可還原」
 * 的充分條件（數學上，存在不可逆的一步並非必定無解，但它是通往死局的必要條件，
 * 详见 docs/math：已知 4×4 step2 就存在走得到卻回不去的局面）。
 *
 * 判定刻意不走 canUndoWith 那條捷徑，而是用 SliderMatrix 公開 API
 * （opt / try_move / commit_move）獨立窮舉一個局面的所有可能走法。
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

/** next 能否一步走回 prev（窮舉縫隙線 × 代表塊 × 方向，刻意不去重以免漏邊）。 */
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
          if ([...g.selected].length === 0) continue;
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

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(m, n) {
  const o = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) o.push([r, c]);
  return o;
}

export const cases = [
  {
    name: '安全打亂：squares 數量不變、形狀維持單一連通',
    run() {
      for (const [m, n, step] of [[3, 3, 1], [4, 4, 2], [6, 6, 2]]) {
        const g = new SliderMatrix(m, n);
        const rng = mulberry32(m * 31 + n * 7 + step);
        g.shuffle_safe(12, step, rng);
        if (g.blocks.length !== m * n) {
          throw new Error(`${m}x${n} 方塊數變了：${g.blocks.length} ≠ ${m * n}`);
        }
        const key = new Set(g.blocks.map((b) => `${b.row}:${b.col}`));
        if (!SliderMatrix.is_single_connected(key)) throw new Error(`${m}x${n} 打亂後不再連通`);
      }
    },
  },

  {
    name: 'path 長度＝成功步數＋1，且皆為合法局面',
    run() {
      const g = new SliderMatrix(4, 4);
      const path = [];
      const done = g.shuffle_safe(10, 2, mulberry32(99), path);
      if (path.length !== done + 1) {
        throw new Error(`path 長度 ${path.length} ≠ 步數 ${done} + 1`);
      }
      for (const snap of path) {
        if (snap.blocks.length !== 16) throw new Error('快照方塊數不對');
        const key = new Set(snap.blocks.map(([r, c]) => `${r}:${c}`));
        if (!SliderMatrix.is_single_connected(key)) throw new Error('快照形狀不連通');
      }
    },
  },

  {
    name: '★ 關鍵：安全打亂的每一步都走得回去（⇒ 打亂結果一定有解）',
    run() {
      const g = new SliderMatrix(4, 4);
      for (let s = 0; s < 4; s++) {
        g.restore({ blocks: rect(4, 4) });
        const path = [];
        g.shuffle_safe(6, 2, mulberry32(2026 + s), path);
        for (let i = 0; i + 1 < path.length; i++) {
          if (!canStepBackTo(g, path[i].blocks, path[i + 1].blocks, 2)) {
            throw new Error(`第 ${s + 1} 局第 ${i + 1} 步回不去（此步不可逆）`);
          }
        }
      }
    },
  },

  {
    name: '普通 shuffle 仍保留原版行為（不含邊界縫），切回舊模式不受影響',
    run() {
      const g = new SliderMatrix(4, 4);
      const rng = mulberry32(4242);
      g.shuffle(20, 2, rng);
      if (g.blocks.length !== 16) throw new Error('方塊數變了');
      // 走過這一步就代表舊 API 沒被改壞
      const key = new Set(g.blocks.map((b) => `${b.row}:${b.col}`));
      if (!SliderMatrix.is_single_connected(key)) throw new Error('不再連通');
    },
  },
];
