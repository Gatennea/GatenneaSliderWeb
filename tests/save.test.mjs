/**
 * 存檔/導入測試（M4）：serialize/deserialize 往返、map 導入、切換謎題。
 */
import { GameStore } from '../dist/store/GameStore.js';
import { SliderMatrix } from '../dist/core/SliderMatrix.js';
import { createContext, selectGap, selectBlock, move } from '../dist/core/CommandBus.js';

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
