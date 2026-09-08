/**
 * 存檔/導入測試（M4）：serialize/deserialize 往返、map 導入、切換謎題。
 */
import { GameStore } from '../dist/store/GameStore.js';
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import { createContext, selectGap, selectBlock, move, undo } from '../dist/core/CommandBus.js';

export const cases = [
  {
    name: 'serialize/deserialize 往返保留 puzzle、步數、map、歷史',
    run() {
      const g = new GameStore(4, 4, 2);
      const ctx = g.cmd;
      // 一整次三連：選 h line=1 上方 12 塊右移
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      const m = move(ctx, 'd');
      if (!m.ok) throw new Error('移動應成功：' + m.message);

      const p = g.serialize();
      if (p.puzzle.m !== 4 || p.puzzle.n !== 4 || p.puzzle.step !== 2) throw new Error('puzzle 參數不符');
      if (p.step_count !== 1) throw new Error('step_count 應為 1');
      if (typeof p.map !== 'string' || p.map.length === 0) throw new Error('map 缺');
      if (!Array.isArray(p.history) || p.history.length < 2) throw new Error('歷史快照應至少 2 筆');

      const g2 = new GameStore();
      if (!g2.deserialize(p)) throw new Error('deserialize 失敗');
      if (g2.currentM !== 4 || g2.currentN !== 4 || g2.currentStep !== 2) throw new Error('還原 puzzle 不符');
      if (g2.cmd.stepCount !== 1) throw new Error('還原 stepCount 不符');
      if (g2.game.export_map() !== p.map) throw new Error('還原 map 不符');
    },
  },
  {
    name: '載入存檔後可撤銷（歷史快照還原）',
    run() {
      const g = new GameStore(4, 4, 2);
      const ctx = g.cmd;
      selectGap(ctx, 'h', 1);
      selectBlock(ctx, 0, 0);
      move(ctx, 'd');
      const p = g.serialize();
      const g2 = new GameStore();
      g2.deserialize(p);
      if (g2.cmd.history.length < 2) throw new Error('載入後歷史應有至少 2 筆');
      const r = undo(g2.cmd);
      if (!r.ok) throw new Error('載入後應可撤銷');
      if (g2.cmd.stepCount !== 0) throw new Error('撤銷後步數應為 0');
      if (!g2.game.is_solved()) throw new Error('撤銷後應回到復原態');
    },
  },
  {
    name: '相容原版 save JSON（matrix/bounds 歷史）且可撤銷',
    run() {
      const g = new GameStore(4, 4, 2);
      const snap0 = {
        matrix: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],
        bounds: { min_row: 0, max_row: 3, min_col: 0, max_col: 3 },
      };
      // 移動後 4x6 map（寬 6 的實心底列？隨意一組非復原佔位）
      const snap1 = {
        matrix: [[0,0,1,1,1,1],[0,0,1,1,1,1],[1,1,1,1,0,0],[1,1,1,1,0,0]],
        bounds: { min_row: 0, max_row: 3, min_col: 0, max_col: 5 },
      };
      const p = {
        version: 1,
        puzzle: { m: 4, n: 4, step: 2 },
        step_count: 1,
        history: { history_index: 1, snapshots: [snap0, snap1] },
      };
      const g2 = new GameStore();
      g2.deserialize(p);
      if (g2.game.m !== 4 || g2.game.n !== 4) throw new Error('載入原版存檔後 m/n 應維持謎題尺寸 4');
      // 未復原時 is_solved 可能 false；我們只驗證可撤銷回初始
      const r = undo(g2.cmd);
      if (!r.ok) throw new Error('原版存檔載入後應可撤銷');
      if (!g2.game.is_solved()) throw new Error('撤銷後應回到復原態');
    },
  },
  {
    name: '切換謎題 newPuzzle 校驗 step < max(m,n)',
    run() {
      const g = new GameStore();
      if (g.newPuzzle(6, 6, 2) !== true) throw new Error('6x6 step2 應可切換');
      if (g.newPuzzle(4, 4, 4) !== false) throw new Error('step==max 應拒絕');
      if (g.newPuzzle(4, 4, 5) !== false) throw new Error('step>max 應拒絕');
    },
  },
  {
    name: 'map 導入（#/_ 文本）後可還原與再導出',
    run() {
      const g = new GameStore(4, 4, 2);
      g.game.import_map('####\n####\n####\n####');
      if (!g.solved) throw new Error('導入完整矩形應已還原');
      if (g.game.export_map() !== '####\n####\n####\n####') throw new Error('導出應一致');
    },
  },
];
