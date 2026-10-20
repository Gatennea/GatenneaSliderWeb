/**
 * 「打亂出來的局面一定有解」—— 端到端證書。
 *
 * 之前的 verify-shuffle.mjs 只驗證到「每一步都走得回去」這一層，結論「整條路徑反過來
 * 就是一條解法」仍然要靠讀者自己推一步。這裡把那一步也做掉：
 *
 *   對每一個安全打亂出來的局面，**真的把反轉路徑走一遍**，逐步找出「從 path[i+1]
 *   走回 path[i]」的那一步合法走法，直到回到最初的實心矩形，最後斷言 is_solved()。
 *
 * 這樣交出的是一份**可獨立覆核的見證（witness）**：一串具體走法
 * （哪條縫、哪一側、往哪個方向、推了幾塊），每一步都由遊戲核心自己判定為合法走法，
 * 末端由遊戲核心自己判定為已還原。你不信推理也沒關係 —— 照著這串走法點一遍就知道了。
 *
 * 刻意不碰 canUndoWith / shuffle_safe 的內部：這裡只用公開的 opt / try_move /
 * commit_move，以及 shuffle_safe 記下的局面快照作為「要走到哪裡」的目標。
 *
 * 用法：node scripts/certify-shuffle.mjs            （預設：小樣本 + 一個 3×3 逐步示範）
 *       node scripts/certify-shuffle.mjs --show     （只跑那個逐步示範）
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';

const DIR_LABEL = { a: '←左', d: '→右', w: '↑上', s: '↓下' };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t, 7 | 0) * 61) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(m, n) {
  const o = [];
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) o.push([r, c]);
  return o;
}

function keyOf(coords) {
  const minR = Math.min(...coords.map((p) => p[0]));
  const minC = Math.min(...coords.map((p) => p[1]));
  return coords
    .map(([r, c]) => `${r - minR}:${c - minC}`)
    .sort()
    .join('|');
}

function coordsOf(g) {
  return g.blocks.map((b) => [b.row, b.col]);
}

/** 玩家實際能用的全部縫隙（含邊界縫）——比 shuffle 用的集合更大，證書更穩。 */
function allGaps(g) {
  const b = g.get_boundaries();
  const out = [];
  for (let l = b.min_row; l < b.max_row; l++) if (g.is_valid_h_line(l)) out.push(['h', l]);
  for (let l = b.min_col; l < b.max_col; l++) if (g.is_valid_v_line(l)) out.push(['v', l]);
  return out;
}

/**
 * 在當前局面裡找一步合法走法，使落點**恰好等於** targetKey。
 * 找到就回傳描述；找不到回傳 null。全程只用公開 API。
 */
function findMoveTo(g, targetKey, step) {
  // opt / try_move 都是純邏輯（只動 selected，不動座標），所以搜尋期完全不需要
  // snapshot/restore —— 只有真正命中時才提交。
  // 同一條縫上，選中集合相同的代表塊只試一次（嚴格等價，不會漏走法），
  // 8×8 時能把候選數從「塊數」降到「分量數」，快一個量級。
  const seenSel = new Set();
  for (const [gapType, line] of allGaps(g)) {
    for (const [rr, cc] of coordsOf(g)) {
      const block = g.blocks.find((x) => x.row === rr && x.col === cc);
      if (!block) continue;
      g.opt(gapType, line, block);
      const selKey0 = [...g.selected].map((x) => `${x.row}:${x.col}`).sort().join(',');
      if (seenSel.has(gapType + line + '|' + selKey0)) continue;
      seenSel.add(gapType + line + '|' + selKey0);
      for (const dir of gapType === 'h' ? ['a', 'd'] : ['w', 's']) {
        g.opt(gapType, line, block);
        const count = g.selected.size;
        if (count === 0) continue;
        const fp = g.try_move(dir, step);
        if (!fp) continue;
        // 落點：被選中的方塊照 fp 走，其餘原地不動（與 commit_move 的順序一致）
        const sel = new Set([...g.selected].map((b) => `${b.row}:${b.col}`));
        const landed = [];
        let i = 0;
        for (const b of g.blocks) {
          if (sel.has(`${b.row}:${b.col}`)) {
            landed.push([fp[i][0], fp[i][1]]);
            i++;
          } else {
            landed.push([b.row, b.col]);
          }
        }
        if (keyOf(landed) !== targetKey) continue;
        g.commit_move(fp); // 走法合法性已由 try_move 判定
        g.selected.clear();
        return { gapType, line, dir, count };
      }
    }
  }
  g.selected.clear();
  return null;
}

const DR = { w: -1, s: 1, a: 0, d: 0 };
const DC = { a: -1, d: 1, w: 0, s: 0 };

/**
 * 逐步示範：把一個 3×3 安全打亂的局面，一步步走回矩形，每一步都印出地圖。
 */
function demonstrate(seed) {
  const m = 3;
  const n = 3;
  const step = 1;
  const rng = mulberry32(seed);
  const g = new SliderMatrix(m, n);
  const path = [];
  g.shuffle_safe(6, step, rng, path);
  const moves = [];

  console.log(`\n===== 逐步示範：3×3 step1，安全打亂 ${path.length - 1} 步（亂數種子 ${seed}）=====`);
  console.log('\n打亂出來的局面（這就是玩家看到的開局）：');
  console.log(g.export_map().split('\n').map((s) => '    ' + s).join('\n'));
  console.log(`    is_solved() = ${g.is_solved()}`);

  // 從末態往回走
  for (let i = path.length - 1; i > 0; i--) {
    g.restore({ blocks: path[i].blocks });
    const mv = findMoveTo(g, keyOf(path[i - 1].blocks), step);
    if (!mv) {
      console.error(`\n✘ 第 ${i} 步走不回去（找不到任何合法走法能回到上一個局面）`);
      return false;
    }
    moves.push(mv);
    if (m <= 4 && n <= 4) {
      console.log(
        `\n  第 ${moves.length} 步：${mv.gapType === 'h' ? '橫' : '豎'}縫 @ ${mv.line}，`
          + `推 ${DIR_LABEL[mv.dir]}，動 ${mv.count} 塊`,
      );
      console.log(g.export_map().split('\n').map((s) => '    ' + s).join('\n'));
    }
  }

  const finalKey = keyOf(coordsOf(g));
  const ok = finalKey === keyOf(path[0].blocks) && g.is_solved();
  console.log(`\n  走完 ${moves.length} 步後：is_solved() = ${g.is_solved()}`);
  console.log(g.export_map().split('\n').map((s) => '    ' + s).join('\n'));
  console.log(ok ? '  ✔ 確實還原成實心矩形' : '  ✘ 沒有還原');
  return ok;
}

/** 批次：不同尺寸 × 多個亂數種子，逐一走一遍並統計。 */
function batch() {
  // 8×8 每一步要枚舉上千個候選走法，很慢，故種子數刻意少；想加量再改這裡。
  const scenarios = [
    { m: 3, n: 3, step: 1, seeds: 40 },
    { m: 4, n: 4, step: 2, seeds: 20 },
    { m: 6, n: 6, step: 2, seeds: 4 },
    { m: 8, n: 8, step: 2, seeds: 1 },
  ];
  let allOk = true;
  let totalBoards = 0;
  let totalSteps = 0;
  const t0 = Date.now();

  for (const sc of scenarios) {
    const attempts = sc.m * sc.n * 10; // 與 main.ts 實際參數一致
    let ok = 0;
    let steps = 0;
    let boards = 0;
    const ts = Date.now();
    for (let s = 0; s < sc.seeds; s++) {
      const rng = mulberry32(sc.m * 7919 + sc.n * 31 + s);
      const g = new SliderMatrix(sc.m, sc.n);
      const path = [];
      g.shuffle_safe(attempts, sc.step, rng, path);
      if (path.length < 2) continue;
      boards++;

      let good = true;
      for (let i = path.length - 1; i > 0; i--) {
        g.restore({ blocks: path[i].blocks });
        const mv = findMoveTo(g, keyOf(path[i - 1].blocks), sc.step);
        if (!mv) {
          good = false;
          console.error(`  ✘ ${sc.m}×${sc.n} seed${s}：第 ${i} 步走不回去`);
          break;
        }
        steps++;
      }
      if (good && g.is_solved()) ok++;
      else {
        allOk = false;
        console.error(`  ✘ ${sc.m}×${sc.n} seed${s}：走完沒有還原`);
      }
    }
    totalBoards += boards;
    totalSteps += steps;
    console.log(
      `${sc.m}×${sc.n} step${sc.step}（每局 ${attempts} 次嘗試）：`
        + `${ok}/${boards} 局的反向解法全程走得通、末端確實還原   ${Date.now() - ts}ms`,
    );
  }
  console.log(
    `\n共 ${totalBoards} 個打亂局面、${totalSteps} 步解法逐一步過；總耗時 ${Date.now() - t0}ms`,
  );
  return allOk;
}

const onlyShow = process.argv.includes('--show');
let pass;
if (onlyShow) {
  pass = demonstrate(20261018);
} else {
  console.log('安全打亂「一定有解」的端到端證書：把反轉路徑真的走一遍，末端由 is_solved() 判定');
  pass = batch() && demonstrate(20261018);
}
if (!pass) {
  console.error('\n[certify] 失敗');
  process.exit(1);
}
console.log('\n[certify] 通過：每個被檢查的打亂局面，都取得了「一條能走回矩形的實際走法」');
