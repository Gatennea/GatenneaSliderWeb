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
      // 3×3 step2 的合法走法本來就少，一次打亂有可能一步都沒走成（仍是一個還原局面）。
      // 那是隨機性、不是 bug：多試幾次再斷言，別讓這條用例偶爾紅。
      let disturbed = false;
      for (let i = 0; i < 8 && !disturbed; i++) {
        shuffle(ctx, 50);
        disturbed = !ctx.game.is_solved();
      }
      if (!disturbed) throw new Error('打亂後不應還原（連試 8 次都沒打亂成功）');
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
    name: '移動後保留縫隙與滑塊組選中，可連續滑動',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      if (!move(ctx, 'd').ok) throw new Error('第一次 d 應成功');
      if (!ctx.selectedGap || ctx.selectedGap.type !== 'h' || ctx.selectedGap.line !== 1) {
        throw new Error('移動後應保留縫隙選中');
      }
      if (!ctx.selectedBlock) throw new Error('移動後應保留滑塊組選中');
      if (!move(ctx, 'a').ok) throw new Error('不重選可直接反向移動');
      if (ctx.stepCount !== 2) throw new Error('連續兩步 stepCount 應為 2');
    },
  },
  {
    name: 'reset 回到復原狀態並清空歷史',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      move(ctx, 'd');
      const r = reset(ctx);
      if (!r.ok) throw new Error('reset 應成功');
      if (!ctx.game.is_solved()) throw new Error('reset 後應為復原狀態');
      if (ctx.stepCount !== 0) throw new Error('reset 後步數應為 0');
      if (ctx.history.length !== 1) throw new Error('reset 後歷史應只有初始快照');
      if (ctx.selectedGap || ctx.selectedBlock) throw new Error('reset 後應清除選中');
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

  {
    name: 'selectGap 拒絕邊界縫（整盤外沿）——合法縫兩側必有方塊',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      const b = ctx.game.get_boundaries();
      // h：合法區間 [min_row, max_row)；上下外沿各越界一個都應被拒
      if (selectGap(ctx, 'h', b.min_row - 1).ok) throw new Error('h 上外沿縫不應合法');
      if (selectGap(ctx, 'h', b.max_row).ok) throw new Error('h 下外沿縫不應合法');
      if (selectGap(ctx, 'v', b.min_col - 1).ok) throw new Error('v 左外沿縫不應合法');
      if (selectGap(ctx, 'v', b.max_col).ok) throw new Error('v 右外沿縫不應合法');
      // 區間內部的縫照常合法（迴歸對照：不是把門焊死）
      if (!selectGap(ctx, 'h', b.min_row).ok) throw new Error('區間內的 h 縫應合法');
      if (!selectGap(ctx, 'v', b.min_col).ok) throw new Error('區間內的 v 縫應合法');
    },
  },

  {
    name: '禁止整體滑動：繞過校驗的邊界縫一旦選中全體方塊，命令層必須拒絕（引擎層與原版一致放行）',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      const b = ctx.game.get_boundaries();
      // 先證明 hazard 真實存在：邊界縫下 opt 的連通分量就是全體（縫的同一側）
      const seed = ctx.game.blocks[0];
      ctx.selectedGap = { type: 'h', line: b.max_row }; // 繞過 selectGap 直接賦值（複現手勢路徑的漏洞）
      ctx.selectedBlock = [seed.row, seed.col];
      ctx.game.opt('h', b.max_row, seed);
      if (ctx.game.selected.size !== ctx.game.blocks.length) {
        throw new Error('邊界縫下選中組應為全體（測試前提不成立）');
      }
      // 引擎層與原版一致：剛體平移本身是合法移動（放行）——規則屬於「網站不給這麼玩」
      if (ctx.game.try_move('d', 2) === null) throw new Error('引擎層應放行（與原版語義一致）');
      // 命令層攔截：CommandBus.move 拒絕，且局面不變
      const before = JSON.stringify(ctx.game.export_map());
      const m = move(ctx, 'd');
      if (m.ok) throw new Error('CommandBus 放行了整盤平移');
      if (JSON.stringify(ctx.game.export_map()) !== before) throw new Error('拒絕後局面不應變化');
      // 對照：換成合法縫隙後同方向就能動（攔截沒有誤傷正常操作）
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      if (!move(ctx, 'd').ok) throw new Error('合法縫隙應照常可移動');
    },
  },
];
