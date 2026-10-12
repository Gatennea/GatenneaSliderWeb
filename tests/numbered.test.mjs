/**
 * 數字形態與新手引導局面（M7）
 *
 * 數字形態 = 方形底板 + 編號，過關條件與方形相同，編號只是給玩家看的線索。
 * 所以這裡要守住的是「編號不能丟」：撤銷/重做、跳步、存檔讀檔都要帶著走。
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import { GameHistory } from '../dist/core/GameHistory.js';
import { GameStore } from '../dist/store/GameStore.js';
import { createContext, selectGap, selectBlock, move, undo } from '../dist/core/CommandBus.js';

export const cases = [
  {
    name: '數字形態：編號按行主序 1..m*n，關掉後清空',
    run() {
      const g = new SliderMatrix(4, 4);
      if (g.blocks.some((b) => b.number !== null)) throw new Error('預設不應有編號');
      g.assignNumbers(true);
      const nums = g.blocks.map((b) => b.number);
      if (nums.join(',') !== Array.from({ length: 16 }, (_, i) => i + 1).join(',')) {
        throw new Error('編號應為 1..16：' + nums.join(','));
      }
      g.assignNumbers(false);
      if (g.blocks.some((b) => b.number !== null)) throw new Error('關閉後編號應清空');
    },
  },
  {
    name: '數字形態：過關條件與方形相同（只看有沒有拼成實心矩形）',
    run() {
      const g = new SliderMatrix(4, 4);
      g.assignNumbers(true);
      // 把最後一排整排右移一格：編號全亂，但仍然不是實心矩形
      for (const b of g.blocks) if (b.row === 3) b.location = [3, b.col + 1];
      if (g.is_solved()) throw new Error('錯開一排不算復原');
      for (const b of g.blocks) if (b.row === 3) b.location = [3, b.col - 1];
      if (!g.is_solved()) throw new Error('推回去應算復原（編號順序不影響勝負）');
    },
  },
  {
    name: '數字形態：snapshot / restore 帶著編號走',
    run() {
      const g = new SliderMatrix(3, 3);
      g.assignNumbers(true);
      const snap = g.snapshot();
      if (!snap.numbers) throw new Error('數字形態的快照應帶 numbers');
      g.assignNumbers(false);
      if (g.blocks[0].number !== null) throw new Error('已清空');
      g.restore(snap);
      if (g.blocks.map((b) => b.number).join(',') !== '1,2,3,4,5,6,7,8,9') {
        throw new Error('restore 應把編號帶回來');
      }
    },
  },
  {
    name: '數字形態：undo / redo 不會把編號弄丟',
    run() {
      const ctx = createContext(new SliderMatrix(4, 4), 2);
      ctx.game.assignNumbers(true);
      const h = new GameHistory();
      h.save_snapshot(ctx.game);
      selectGap(ctx, 'h', 2);
      selectBlock(ctx, 0, 0);
      const m = move(ctx, 'd');
      if (!m.ok) throw new Error('應能移動：' + m.message);
      h.save_snapshot(ctx.game);
      if (ctx.game.blocks.some((b) => b.number === null)) throw new Error('移動後編號不該消失');

      h.undo(ctx.game);
      if (ctx.game.blocks.some((b) => b.number === null)) throw new Error('undo 後編號不該消失');
      if (ctx.game.blocks.map((b) => b.number).join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16') {
        throw new Error('undo 後編號應仍是 1..16（跟著各自滑塊）');
      }
      h.redo(ctx.game);
      if (ctx.game.blocks.some((b) => b.number === null)) throw new Error('redo 後編號不該消失');
    },
  },
  {
    name: '存檔：數字形態的編號會存進去、讀得出來；方形存檔維持原格式',
    run() {
      const a = new GameStore(4, 4, 2, true);
      a.cmd.history.save_snapshot(a.game);
      const payload = JSON.parse(JSON.stringify(a.serialize()));
      if (payload.puzzle.kind !== 'numbered') throw new Error('puzzle 應標記 numbered');
      const snap0 = payload.history.snapshots[0];
      if (!Array.isArray(snap0.numbers)) throw new Error('快照應帶 numbers');
      // matrix 仍是 0/1，原版讀得到（只是沒有編號，退化為方形）
      for (const row of snap0.matrix) {
        for (const v of row) if (v !== 1) throw new Error('matrix 應維持 0/1：' + v);
      }

      const b = new GameStore(4, 4, 2, false);
      if (!b.deserialize(payload)) throw new Error('應能讀回');
      if (!b.numbered) throw new Error('讀回後應是數字形態');
      if (b.game.blocks.some((x) => x.number === null)) throw new Error('讀回後編號不該消失');

      const plain = new GameStore(4, 4, 2, false);
      plain.cmd.history.save_snapshot(plain.game);
      const p2 = plain.serialize();
      if (p2.puzzle.kind) throw new Error('方形存檔不該加 kind');
      if (p2.history.snapshots[0].numbers) throw new Error('方形存檔不該加 numbers');
    },
  },
  {
    name: '謎題分組鍵：數字形態後綴 #num',
    run() {
      const a = new GameStore(4, 4, 2, false);
      if (a.puzzleKey !== '2~4*4') throw new Error('應為 2~4*4：' + a.puzzleKey);
      a.setNumbered(true);
      if (a.puzzleKey !== '2~4*4#num') throw new Error('應為 2~4*4#num：' + a.puzzleKey);
    },
  },
  {
    name: '引導局面：一步就能推回去（點橫縫 → 點最下排 → 往左）',
    run() {
      const store = new GameStore(4, 4, 2);
      store.loadTutorialPosition();
      if (store.solved) throw new Error('引導局面不該一開始就是復原態');
      if (store.currentStep !== 1) throw new Error('引導應為等級 1');

      // 引導的三步：第 3、4 行之間的橫縫（line=2）→ 點第 4 行任一塊 → 往左推
      const ctx = store.cmd;
      const r1 = selectGap(ctx, 'h', 2);
      if (!r1.ok) throw new Error('應能選縫：' + r1.message);
      const r2 = selectBlock(ctx, 3, 1);
      if (!r2.ok) throw new Error('應能選塊：' + r2.message);
      if (ctx.game.selected.size !== 4) throw new Error('應選中整排 4 塊：' + ctx.game.selected.size);
      const r3 = move(ctx, 'a');
      if (!r3.ok) throw new Error('應能往左推：' + r3.message);
      if (!store.solved) throw new Error('推完應復原');

      // 推完再撤銷要能回到引導局面，且撤銷後仍不是復原態
      undo(ctx);
      if (store.solved) throw new Error('撤銷後不該是復原態');
    },
  },
];
