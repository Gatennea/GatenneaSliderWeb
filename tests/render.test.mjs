/**
 * 渲染選中效果測試（M2）：驗證
 *   - 選中組（opt）會被畫成 block_selected 綠
 *   - 選中縫隙會畫出紅色 line/半透明帶
 */
import { BoardRenderer } from '../dist/render/BoardRenderer.js';
import { GameStore } from '../dist/store/GameStore.js';
import { COLORS } from '../dist/render/theme.js';

/** 記錄每次 fillStyle / strokeStyle 設值，供斷言 */
function recordingCtx() {
  const set = [];
  const ctx = {
    canvas: { width: 800, height: 500 },
    _set: set,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    arcTo() {},
    closePath() {},
  };
  // 用 property 攔截記錄 fillStyle / strokeStyle 寫入
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

export const cases = [
  {
    name: '選中組以綠色填充繪製',
    run() {
      const store = new GameStore(4, 4, 2);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      // 選中 h line=1 上側（8 塊）
      const start = store.game.blocks.find((b) => b.row === 0 && b.col === 0);
      store.game.opt('h', 1, start);
      r.draw(store);
      const fills = ctx._set.filter(([k]) => k === 'fill').map(([, v]) => v);
      if (!fills.includes(COLORS.block_selected)) {
        throw new Error('未發現選中組綠色填充');
      }
      if (!fills.includes(COLORS.block)) {
        throw new Error('未發現未選中藍色填充');
      }
    },
  },
  {
    name: '選中縫隙畫出紅色 line',
    run() {
      const store = new GameStore(4, 4, 2);
      const ctx = recordingCtx();
      const r = new BoardRenderer(ctx, 1);
      store.cmd.selectedGap = { type: 'h', line: 1 };
      r.draw(store);
      const strokes = ctx._set.filter(([k]) => k === 'stroke').map(([, v]) => v);
      if (!strokes.includes(COLORS.line)) {
        throw new Error('未發現選中縫隙紅色 stroke（line）');
      }
    },
  },
];
