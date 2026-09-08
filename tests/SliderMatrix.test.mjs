/**
 * 核心邏輯測試（對照 game.py / history.py）
 * 由 scripts/run-tests.mjs 執行；這裡只匯出帶名稱的案例。
 */
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import { GameHistory } from '../dist/core/GameHistory.js';

/** 位置集合字串化，方便比較 */
function blocksOf(game) {
  return game.blocks
    .map((b) => `${b.row}:${b.col}`)
    .sort()
    .join(' ');
}

export const cases = [
  {
    name: '初始 4×4 即為還原',
    run() {
      const g = new SliderMatrix(4, 4);
      if (!g.is_solved()) throw new Error('solved 應為 true');
      if (g.blocks.length !== 16) throw new Error('blocks 應為 16');
    },
  },
  {
    name: 'is_single_connected 判定單一連通',
    run() {
      if (!SliderMatrix.is_single_connected(new Set(['0:0', '0:1', '1:0']))) {
        throw new Error('應為連通');
      }
      if (SliderMatrix.is_single_connected(new Set(['0:0', '2:0']))) {
        throw new Error('應為不連通');
      }
    },
  },
  {
    name: 'check_move_valid 碰撞與連通',
    run() {
      if (SliderMatrix.check_move_valid(new Set(['0:0']), new Set(['0:0']))) {
        throw new Error('重疊應判 collision=false');
      }
      if (!SliderMatrix.check_move_valid(new Set(['1:0', '1:1']), new Set(['0:0', '0:1']))) {
        throw new Error('應合法');
      }
    },
  },
  {
    name: 'opt 選中 h 分割線一側的連通組',
    run() {
      const g = new SliderMatrix(4, 4);
      const start = g.blocks.find((b) => b.row === 0 && b.col === 0);
      const selected = g.opt('h', 1, start);
      const got = [...selected].sort().join(' ');
      const want = ['0:0', '0:1', '0:2', '0:3', '1:0', '1:1', '1:2', '1:3'].sort().join(' ');
      if (got !== want) throw new Error(`opt h1 選中不符：\n${got}\n${want}`);
      if (g.selected.size !== 8) throw new Error('selected.size 應為 8');
    },
  },
  {
    name: 'opt 選中 v 分割線一側',
    run() {
      const g = new SliderMatrix(4, 4);
      const start = g.blocks.find((b) => b.row === 0 && b.col === 3);
      const selected = g.opt('v', 1, start);
      if (selected.size !== 8) throw new Error(`應選中 8 塊，實為 ${selected.size}`);
    },
  },
  {
    name: 'try_move：整組可平移；碰撞/斷連被拒',
    run() {
      const g = new SliderMatrix(4, 4);
      const start = g.blocks.find((b) => b.row === 0 && b.col === 0);
      g.opt('h', 3, start); // 全 16 塊
      const finals = g.try_move('s', 2);
      if (!finals || finals.length !== 16) throw new Error('全選應可平移');
      g.commit_move(finals);
      if (!g.is_solved()) throw new Error('整體平移後仍應還原');

      const g2 = new SliderMatrix(4, 4);
      const top = g2.blocks.find((b) => b.row === 0 && b.col === 0);
      g2.opt('h', 0, top); // 只選第一行
      if (g2.try_move('s', 2) !== null) throw new Error('應因碰撞被拒');
    },
  },
  {
    name: 'shuffle 打亂後未復原且仍單一連通',
    run() {
      const g = new SliderMatrix(4, 4);
      g.shuffle(200, 2);
      if (g.is_solved()) throw new Error('打亂後不應還原');
      const all = new Set(g.blocks.map((b) => `${b.row}:${b.col}`));
      if (!SliderMatrix.is_single_connected(all)) throw new Error('打亂後應單一連通');
    },
  },
  {
    name: 'GameHistory save/undo/redo 往返一致',
    run() {
      const g = new SliderMatrix(4, 4);
      const h = new GameHistory();
      h.save_snapshot(g);

      const start = g.blocks.find((b) => b.row === 0 && b.col === 0);
      g.opt('v', 3, start);
      const finals = g.try_move('s', 2);
      g.commit_move(finals);
      g.selected.clear();
      h.save_snapshot(g);
      const afterMove = blocksOf(g);

      h.undo(g);
      if (h.currentIndex !== 0) throw new Error('undo index 應為 0');
      const initial = [...new SliderMatrix(4, 4).blocks].map((b) => `${b.row}:${b.col}`).sort().join(' ');
      if (blocksOf(g) !== initial) throw new Error('undo 應回到初始');

      h.redo(g);
      if (blocksOf(g) !== afterMove) throw new Error('redo 應回到移動後');
    },
  },
  {
    name: 'undo 後再 save 會截斷 redo 分支',
    run() {
      const g = new SliderMatrix(4, 4);
      const h = new GameHistory();
      h.save_snapshot(g);
      h.save_snapshot(g);
      h.save_snapshot(g);
      h.undo(g); // 現在 index=1，redo 分支 [index+1..] 應被截斷
      h.save_snapshot(g); // 截斷後再追加 → 保留 [0,1] + 新 = 3
      if (h.length !== 3) throw new Error(`length 應 3，實為 ${h.length}`);
      if (h.canRedo) throw new Error('截斷後不應可 redo');
    },
  },
  {
    name: 'export/import map 互通',
    run() {
      const g = new SliderMatrix(4, 4);
      if (g.export_map() !== '####\n####\n####\n####') throw new Error('初始 export 應為 4 行 #');

      const g2 = new SliderMatrix(4, 4);
      const ok = g2.import_map('####\n####\n####\n####');
      if (!ok) throw new Error('import 應成功');
      if (!g2.is_solved()) throw new Error('import 後應還原');
      if (g2.blocks.length !== 16) throw new Error('import 後 blocks 應 16');
    },
  },
];
