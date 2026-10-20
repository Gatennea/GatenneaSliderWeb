/**
 * 棋盤標記 + 復原彈窗測試（補齊計劃第 4 站）：
 *   - SolvedPopupTracker：邊緣檢測 + viaRedo/viaUndo/locked 三重抑制 + 基線同步
 *   - drawBoardMarks：目標框 / 洞(圓圈) / 缺口(三角) / 凸起(菱形)、大紅小藍、開關
 *   - drawSolvedPopup：標題/正文/競速成績/PB 恭喜、6 秒自動關閉、命中與關閉
 *
 * 說明：drawBoardMarks / drawSolvedPopup / popupFrame 在 TS 裡是 private，
 * 編譯到 dist 後就是普通方法，無頭測試直接驅動它們（瀏覽器路徑由 draw() 掛載，
 * 另有開關用例走完整 draw() 驗證掛載點）。
 */
import { SolvedPopupTracker } from '../dist/feature/solvedPopup.js';
import { BoardRenderer } from '../dist/render/BoardRenderer.js';
import { GameStore } from '../dist/store/GameStore.js';
import { COLORS } from '../dist/render/theme.js';
import { findTargetWindow, detectHoles } from '../dist/solver/gather.js';
import { stateFromBlocks } from '../dist/solver/model.js';

/** 記錄 fillStyle / strokeStyle 寫值 + ctx 方法調用序列（供斷言顏色與圖形） */
function recordingCtx(w = 800, h = 500) {
  const set = [];
  const calls = [];
  const ctx = {
    canvas: { width: w, height: h },
    _set: set,
    _calls: calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  };
  for (const m of [
    'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill',
    'arcTo', 'arc', 'closePath', 'save', 'restore', 'fillText',
  ]) {
    ctx[m] = () => { calls.push(m); };
  }
  Object.defineProperty(ctx, 'fillStyle', {
    get() { return this._fillStyle; },
    set(v) { this._fillStyle = v; set.push(['fill', v]); },
  });
  Object.defineProperty(ctx, 'strokeStyle', {
    get() { return this._strokeStyle; },
    set(v) { this._strokeStyle = v; set.push(['stroke', v]); },
  });
  return ctx;
}

/** 把調用序列切成一段段路徑（beginPath..closePath/stroke/fill），返回每段的方法名陣列 */
function pathShapes(calls) {
  const shapes = [];
  let cur = null;
  for (const name of calls) {
    if (name === 'beginPath') cur = [];
    else if (name === 'closePath' || name === 'stroke' || name === 'fill') {
      if (cur) shapes.push(cur);
      cur = null;
    } else if (cur) cur.push(name);
  }
  return shapes;
}

const countShape = (calls, shape) =>
  pathShapes(calls).filter((s) => s.length === shape.length && s.every((m, i) => m === shape[i])).length;

const CIRCLE = ['arc'];
const TRIANGLE = ['moveTo', 'lineTo', 'lineTo'];
const DIAMOND = ['moveTo', 'lineTo', 'lineTo', 'lineTo'];

const fillsOf = (ctx) => ctx._set.filter(([k]) => k === 'fill').map(([, v]) => v);
const strokesOf = (ctx) => ctx._set.filter(([k]) => k === 'stroke').map(([, v]) => v);

const box = (r0, r1, c0, c1) => {
  const out = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([r, c]);
  return out;
};

/**
 * 用與渲染器同一份原語（findTargetWindow + detectHoles）推導「這個局面應該畫出哪些顏色」，
 * 再斷言渲染器的用色與之嚴格一致——測的是渲染層的映射（洞→圓圈、缺口→三角、凸起→菱形、
 * 大紅小藍），而不是把某個窗口選擇硬編碼進斷言。
 */
function expectedMarks(blocks, m, n, step) {
  const state = stateFromBlocks(blocks);
  const win = findTargetWindow(state, m, n);
  const rep = detectHoles(state, win, step);
  const colors = new Set([COLORS.mark_target]);
  const largeOf = (cells) => {
    let minR = Infinity; let maxR = -Infinity; let minC = Infinity; let maxC = -Infinity;
    for (const [r, c] of cells) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    return maxR - minR + 1 >= step || maxC - minC + 1 >= step;
  };
  for (const g of [...rep.holes, ...rep.dents]) {
    colors.add(largeOf(g) ? COLORS.mark_hole_large : COLORS.mark_hole_small);
  }
  if (rep.protrusions.length > 0) colors.add(COLORS.mark_protrusion);
  return {
    colors,
    circles: rep.holes.reduce((s, g) => s + g.length, 0),
    triangles: rep.dents.reduce((s, g) => s + g.length, 0),
    diamonds: rep.protrusions.length,
  };
}

const MARK_COLORS = [
  COLORS.mark_target,
  COLORS.mark_hole_large,
  COLORS.mark_hole_small,
  COLORS.mark_protrusion,
];

/** 三個手工構造的局面（都保持 16 塊，符合 m×n 守恆） */
const STATE_SHIFTED_ROW = [...box(0, 2, 0, 3), ...box(3, 3, 1, 4)]; // 底排右移一格：3 凸起 + 1 邊緣缺口
const STATE_INNER_HOLE = [
  ...box(0, 3, 0, 3).filter(([r, c]) => !(r >= 1 && r <= 2 && c >= 1 && c <= 2)), // 中間挖 2×2 洞
  ...box(6, 7, 6, 7), // 遠處 2×2 凸起
];
const STATE_MIXED = [
  ...box(0, 3, 0, 3).filter(([r, c]) => !((r === 1 && c === 1) || (r === 3 && c === 3))), // 內部小洞 + 右下角缺口
  [0, 4], [1, 4], // 右側 2 凸起
];

export const cases = [
  // ---------- SolvedPopupTracker（純邏輯） ----------
  {
    name: 'Tracker：未復原→復原才算過關，觸發一次',
    run() {
      const t = new SolvedPopupTracker();
      if (!t.note(true)) throw new Error('未復原→復原應觸發');
      if (t.note(true)) throw new Error('重複 note 同一狀態不應二次觸發');
    },
  },
  {
    name: 'Tracker：viaRedo / viaUndo / locked 各自抑制',
    run() {
      const mk = () => new SolvedPopupTracker();
      if (mk().note(true, { viaRedo: true })) throw new Error('viaRedo 應抑制');
      if (mk().note(true, { viaUndo: true })) throw new Error('viaUndo 應抑制');
      if (mk().note(true, { locked: true })) throw new Error('locked 應抑制');
      if (!mk().note(true, {})) throw new Error('無抑制標記時應觸發');
    },
  },
  {
    name: 'Tracker：復原→離開→再復原可再次觸發（基線每次同步）',
    run() {
      const t = new SolvedPopupTracker();
      if (!t.note(true)) throw new Error('第一次應觸發');
      if (t.note(false)) throw new Error('離開復原態不觸發');
      if (!t.note(true)) throw new Error('再次復原應觸發');
    },
  },
  {
    name: 'Tracker：reset 同步基線，開局即復原不提示',
    run() {
      const t = new SolvedPopupTracker();
      t.reset(true);
      if (t.note(true)) throw new Error('開局已復原時不應觸發');
      if (t.note(false)) throw new Error('未復原不觸發');
      if (!t.note(true)) throw new Error('之後真正過關應觸發');
    },
  },

  // ---------- drawBoardMarks（棋盤標記） ----------
  {
    name: '棋盤標記：關閉時不出現任何 mark_ 色',
    run() {
      const store = new GameStore(4, 4, 2);
      store.applyPuzzle(4, 4, 2, STATE_INNER_HOLE);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.boardMarksEnabled = false;
      r.draw(store);
      const used = [...fillsOf(ctx), ...strokesOf(ctx)];
      for (const c of MARK_COLORS) {
        if (used.includes(c)) throw new Error(`關閉時不應出現 ${c}`);
      }
    },
  },
  {
    name: '棋盤標記：底排右移局面 = 目標框 + 小缺口(藍三角) + 凸起(黃菱形)',
    run() {
      const store = new GameStore(4, 4, 2);
      store.applyPuzzle(4, 4, 2, STATE_SHIFTED_ROW);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.boardMarksEnabled = true;
      r.draw(store);
      const exp = expectedMarks(STATE_SHIFTED_ROW, 4, 4, 2);
      const strokes = strokesOf(ctx);
      for (const c of exp.colors) {
        if (!strokes.includes(c)) throw new Error(`缺少標記色 ${c}`);
      }
      for (const c of MARK_COLORS) {
        if (!exp.colors.has(c) && strokes.includes(c)) throw new Error(`多畫了不該有的 ${c}`);
      }
      if (countShape(ctx._calls, CIRCLE) !== exp.circles) {
        throw new Error(`圓圈數應 ${exp.circles}，實為 ${countShape(ctx._calls, CIRCLE)}`);
      }
      if (countShape(ctx._calls, TRIANGLE) !== exp.triangles) {
        throw new Error(`三角數應 ${exp.triangles}，實為 ${countShape(ctx._calls, TRIANGLE)}`);
      }
      if (countShape(ctx._calls, DIAMOND) !== exp.diamonds) {
        throw new Error(`菱形數應 ${exp.diamonds}，實為 ${countShape(ctx._calls, DIAMOND)}`);
      }
    },
  },
  {
    name: '棋盤標記：2×2 内洞 = 大紅圓圈；遠處凸起 = 黃菱形',
    run() {
      const store = new GameStore(4, 4, 2);
      store.applyPuzzle(4, 4, 2, STATE_INNER_HOLE);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.boardMarksEnabled = true;
      r.draw(store);
      const exp = expectedMarks(STATE_INNER_HOLE, 4, 4, 2);
      const strokes = strokesOf(ctx);
      for (const c of exp.colors) {
        if (!strokes.includes(c)) throw new Error(`缺少標記色 ${c}`);
      }
      for (const c of MARK_COLORS) {
        if (!exp.colors.has(c) && strokes.includes(c)) throw new Error(`多畫了不該有的 ${c}`);
      }
      if (countShape(ctx._calls, CIRCLE) !== exp.circles) {
        throw new Error(`圓圈數應 ${exp.circles}，實為 ${countShape(ctx._calls, CIRCLE)}`);
      }
      if (countShape(ctx._calls, TRIANGLE) !== exp.triangles) {
        throw new Error(`三角數應 ${exp.triangles}，實為 ${countShape(ctx._calls, TRIANGLE)}`);
      }
      if (countShape(ctx._calls, DIAMOND) !== exp.diamonds) {
        throw new Error(`菱形數應 ${exp.diamonds}，實為 ${countShape(ctx._calls, DIAMOND)}`);
      }
    },
  },
  {
    name: '棋盤標記：混合局面（内部小洞 + 角上缺口 + 2 凸起）',
    run() {
      const store = new GameStore(4, 4, 2);
      store.applyPuzzle(4, 4, 2, STATE_MIXED);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.boardMarksEnabled = true;
      r.draw(store);
      const exp = expectedMarks(STATE_MIXED, 4, 4, 2);
      const strokes = strokesOf(ctx);
      for (const c of exp.colors) {
        if (!strokes.includes(c)) throw new Error(`缺少標記色 ${c}`);
      }
      for (const c of MARK_COLORS) {
        if (!exp.colors.has(c) && strokes.includes(c)) throw new Error(`多畫了不該有的 ${c}`);
      }
      if (countShape(ctx._calls, CIRCLE) !== exp.circles) {
        throw new Error(`圓圈數應 ${exp.circles}，實為 ${countShape(ctx._calls, CIRCLE)}`);
      }
      if (countShape(ctx._calls, TRIANGLE) !== exp.triangles) {
        throw new Error(`三角數應 ${exp.triangles}，實為 ${countShape(ctx._calls, TRIANGLE)}`);
      }
      if (countShape(ctx._calls, DIAMOND) !== exp.diamonds) {
        throw new Error(`菱形數應 ${exp.diamonds}，實為 ${countShape(ctx._calls, DIAMOND)}`);
      }
    },
  },

  // ---------- drawSolvedPopup（復原彈窗） ----------
  {
    name: '復原彈窗：普通模式畫標題/正文，不出成績行',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup(null);
      if (!r.solvedPopupActive) throw new Error('spawn 後應處於顯示中');
      r.solvedPopup.t = 300;
      r.drawSolvedPopup();
      const fills = fillsOf(ctx);
      for (const c of [COLORS.dialog_bg, COLORS.dialog_title, COLORS.popup_body]) {
        if (!fills.includes(c)) throw new Error(`缺少彈窗色 ${c}`);
      }
      if (fills.includes(COLORS.popup_score)) throw new Error('無成績不應畫 TPS 行');
      if (fills.includes(COLORS.popup_pb)) throw new Error('無成績不應畫 PB 恭喜');
    },
  },
  {
    name: '復原彈窗：競速成績 + PB 恭喜（單次/Ao5/Ao12）',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup({ time_ms: 65432, moves: 42, tps: 0.64, pb: { single: true, ao5: true, ao12: true } });
      r.solvedPopup.t = 300;
      r.drawSolvedPopup();
      const fills = fillsOf(ctx);
      for (const c of [COLORS.dialog_bg, COLORS.popup_score, COLORS.popup_pb]) {
        if (!fills.includes(c)) throw new Error(`缺少彈窗色 ${c}`);
      }
    },
  },
  {
    name: '復原彈窗：DNF 成績不畫時間/TPS 行',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup({ time_ms: 99999, moves: 10, tps: 0.1, dnf: true });
      r.solvedPopup.t = 300;
      r.drawSolvedPopup();
      const fills = fillsOf(ctx);
      if (fills.includes(COLORS.popup_score)) throw new Error('DNF 不應畫成績行');
      if (!fills.includes(COLORS.popup_body)) throw new Error('DNF 也應有正文');
    },
  },
  {
    name: '復原彈窗：超過 6 秒 + 淡出時長後不再繪製',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup(null);
      r.solvedPopup.t = 6300; // 6000 + 250 已過
      r.drawSolvedPopup();
      const fills = fillsOf(ctx);
      if (fills.includes(COLORS.dialog_bg)) throw new Error('淡出結束後不應再畫面板');
    },
  },
  {
    name: '復原彈窗：命中矩形跟隨繪製，Esc/點擊可關',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup(null);
      if (r.hitSolvedPopup(334, 250)) throw new Error('未繪製前不應命中');
      r.solvedPopup.t = 300;
      r.drawSolvedPopup();
      // 畫布 800×500，面板 460×200，中心 = ((800-132)/2, 250) = (334, 250)
      if (!r.hitSolvedPopup(334, 250)) throw new Error('面板中心應命中');
      if (!r.hitSolvedPopup(105, 151)) throw new Error('面板左上角內側應命中');
      if (r.hitSolvedPopup(10, 10)) throw new Error('面板外不應命中');
      if (r.hitSolvedPopup(700, 450)) throw new Error('右欄區域不應命中');
      r.closeSolvedPopup();
      if (r.solvedPopupActive) throw new Error('關閉後不應仍處於顯示中');
      if (r.hitSolvedPopup(334, 250)) throw new Error('關閉後不應命中');
    },
  },
  {
    name: '復原彈窗：動畫迴圈 6 秒後自動關閉（無 rAF 環境直接驅動）',
    run() {
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      r.spawnSolvedPopup(null);
      const t0 = r.solvedPopupT0;
      r.popupFrame(t0 + 1000); // 1 秒：仍在顯示
      if (!r.solvedPopupActive) throw new Error('1 秒時不應關閉');
      r.popupFrame(t0 + 6300); // 超過 6s + 250ms 淡出：自動關閉
      if (r.solvedPopupActive) throw new Error('到時應自動關閉');
    },
  },
];
