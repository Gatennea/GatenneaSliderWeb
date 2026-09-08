/**
 * CommandBus 整合測試（M3）：shuffle → move → undo → redo → reset 的完整語義。
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import {
  createContext,
  selectGap,
  selectBlock,
  move,
  undo,
  redo,
  shuffle,
  reset,
} from '../dist/core/CommandBus.js';

function mapOf(ctx) {
  return ctx.game.export_map();
}

export const cases = [
  {
    name: 'shuffle 打亂後 solved=false，reset 回到打亂前',
    run() {
      const ctx = createContext(new SliderMatrix(3, 3), 2);
      const before = ctx.game.snapshot();
      shuffle(ctx, 50);
      if (ctx.game.is_solved()) throw new Error('打亂後不應還原');
      reset(ctx);
      if (JSON.stringify(ctx.game.snapshot().blocks) !== JSON.stringify(before.blocks)) {
        throw new Error('reset 應回到打亂前');
      }
    },
  },
  {
    name: 'move 後 undo/redo 往返一致（含步數）',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      // 選中 h line=2 上方 3 行（12 塊），向右 d 移動
      selectGap(ctx, 'h', 2);
      selectBlock(ctx, 0, 0);
      const m1 = move(ctx, 'd');
      if (!m1.ok) throw new Error('應能移動：' + m1.message);
      if (ctx.stepCount !== 1) throw new Error('stepCount 應為 1');
      const afterMove = mapOf(ctx);

      // undo
      const u = undo(ctx);
      if (!u.ok) throw new Error('應能撤銷');
      if (ctx.stepCount !== 0) throw new Error('undo 後 stepCount 應為 0');
      if (mapOf(ctx) === afterMove) throw new Error('undo 後應回到移動前');

      // redo
      const r = redo(ctx);
      if (!r.ok) throw new Error('應能重做');
      if (mapOf(ctx) !== afterMove) throw new Error('redo 後應回到移動後');
      if (ctx.stepCount !== 1) throw new Error('redo 後 stepCount 應為 1');
    },
  },
  {
    name: '無歷史時 undo/redo 回報邊界提示',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      if (undo(ctx).ok) throw new Error('無歷史 undo 應失敗');
      if (redo(ctx).ok) throw new Error('無歷史 redo 應失敗');
    },
  },
  {
    name: '選中縫隙時移動方向受限（h 只能 a/d）',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      const bad = move(ctx, 's'); // h 縫隙不能上下
      if (bad.ok) throw new Error('h 縫隙 + 上下方向應被判非法');
      const good = move(ctx, 'd');
      if (!good.ok) throw new Error('h 縫隙 + 左右方向應可移動');
    },
  },
];
