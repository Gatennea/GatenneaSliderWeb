/**
 * 成績測試（M6）：AvgOf 的 AoN 語義、stats、add/delete。
 */
// Node 無 localStorage，先注入 stub
globalThis.localStorage = {
  _d: {},
  getItem(k) {
    return this._d[k] ?? null;
  },
  setItem(k, v) {
    this._d[k] = v;
  },
  removeItem(k) {
    delete this._d[k];
  },
};

import { Records, stats, avgOf, puzzleKey } from '../dist/feature/Records.js';

export const cases = [
  {
    name: 'avgOf 不足 n 次回 null',
    run() {
      if (avgOf([1000, 2000], 5) !== null) throw new Error('不足 5 次應 null');
    },
  },
  {
    name: 'avgOf 去掉最好與最差後平均；含 DNF 回 DNF',
    run() {
      // 最近 5 次 [1000,2000,3000,4000,5000] → 去掉 1000、5000 → (2000+3000+4000)/3=3000
      const v = avgOf([1000, 2000, 3000, 4000, 5000], 5);
      if (v !== 3000) throw new Error(`應為 3000，實為 ${v}`);
      // 含兩個 DNF → 剩餘仍有 DNF → 'DNF'
      const d = avgOf([1000, null, null, 2000, 3000], 5);
      if (d !== 'DNF') throw new Error('含 DNF 應回 DNF');
    },
  },
  {
    name: 'add 依 puzzle 分組，stats 統計 count/best/worst/dnf',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      r.add(4, 4, 2, 12000, 10, false);
      r.add(4, 4, 2, 8000, 9, false);
      r.add(4, 4, 2, 20000, 11, true);
      const key = puzzleKey(4, 4, 2);
      const list = r.get(key);
      if (list.length !== 3) throw new Error('應有 3 筆');
      const s = stats(list);
      if (s.count !== 3) throw new Error('count 應 3');
      if (s.best !== 8000) throw new Error('best 應 8000');
      if (s.worst !== 12000) throw new Error(`worst 應 12000（DNF 不計入），實為 ${s.worst}`);
      if (s.dnf_count !== 1) throw new Error('dnf 應 1');
    },
  },
  {
    name: 'delete 移除指定 id，清空後刪除分組',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      const it = r.add(4, 4, 2, 9000, 9, false);
      if (!r.delete(puzzleKey(4, 4, 2), it.id)) throw new Error('delete 應成功');
      if (r.get(puzzleKey(4, 4, 2)).length !== 0) throw new Error('刪除後應空');
    },
  },
];
