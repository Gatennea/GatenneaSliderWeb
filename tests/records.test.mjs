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

import { Records, stats, avgOf, puzzleKey, series, tpsOf, blocksToMap } from '../dist/feature/Records.js';

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
  // ---- 2026-10-19 補齊原版 records.py 的能力 ----
  {
    name: 'series：逐行 rolling Ao5/Ao12（以該條為結尾的窗口，csTimer 風格）',
    run() {
      const mk = (ms) => ({ id: String(ms), ts: 0, m: 4, n: 4, step: 2, time_ms: ms, moves: 1, dnf: false });
      const rows = series([1000, 2000, 3000, 4000, 5000, 6000].map(mk));
      if (rows.length !== 6) throw new Error('應 6 行');
      if (rows[3].ao5 !== null) throw new Error('第 4 行不足 5 次，ao5 應 null');
      if (rows[4].ao5 !== 3000) throw new Error(`第 5 行 ao5 應 3000，實為 ${rows[4].ao5}`);
      if (rows[5].ao5 !== 4000) throw new Error(`第 6 行 ao5 應 4000，實為 ${rows[5].ao5}`);
      if (rows[5].ao12 !== null) throw new Error('不足 12 次 ao12 應 null');
      if (rows[5].item.time_ms !== 6000) throw new Error('每行要帶回原記錄');
    },
  },
  {
    name: 'stats.mean：所有有效成績平均（DNF 不計）',
    run() {
      const mk = (ms, dnf) => ({ id: `${ms}${dnf}`, ts: 0, m: 4, n: 4, step: 2, time_ms: ms, moves: 1, dnf });
      const s = stats([mk(1000, false), mk(3000, false), mk(9999, true)]);
      if (s.mean !== 2000) throw new Error(`mean 應 2000，實為 ${s.mean}`);
      const empty = stats([mk(1000, true)]);
      if (empty.mean !== null) throw new Error('全是 DNF 時 mean 應 null');
    },
  },
  {
    name: 'tpsOf：每秒步數，與原版同口徑',
    run() {
      const it = { id: 'x', ts: 0, m: 4, n: 4, step: 2, time_ms: 5000, moves: 10, dnf: false };
      if (tpsOf(it) !== 2) throw new Error(`TPS 應 2，實為 ${tpsOf(it)}`);
      const zero = { ...it, time_ms: 0 };
      if (tpsOf(zero) !== 0) throw new Error('時間為 0 應回 0，不要出 Infinity/NaN');
    },
  },
  {
    name: 'blocksToMap：開局局面轉等寬地圖（左上角歸一、每格兩字寬）',
    run() {
      const map = blocksToMap([[2, 3], [2, 4], [3, 3]]);
      if (map.length !== 2) throw new Error(`應 2 行，實為 ${map.length}`);
      if (map[0] !== '████') throw new Error(`第一行應 ████，實為 ${map[0]}`);
      if (map[1] !== '██··') throw new Error(`第二行應 ██··，實為 ${map[1]}`);
      if (blocksToMap([]).length !== 0) throw new Error('空輸入回空');
    },
  },
  {
    name: 'add 帶開局局面：存得進去也讀得出來；沒給就不寫這個欄位',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      const initial = [[0, 0], [0, 1], [1, 1]];
      const it = r.add(4, 4, 2, 9000, 9, false, false, initial);
      const back = r.get(puzzleKey(4, 4, 2)).find((x) => x.id === it.id);
      if (!back || !back.initial) throw new Error('應讀回 initial');
      if (JSON.stringify(back.initial) !== JSON.stringify(initial)) {
        throw new Error(`initial 應原樣往返，實為 ${JSON.stringify(back.initial)}`);
      }
      const plain = r.add(4, 4, 2, 8000, 8, false);
      if ('initial' in plain) throw new Error('沒給 initial 時不應出現這個欄位');
    },
  },
  // ---- 復原彈窗的 PB 判定（addTimed） ----
  {
    name: 'addTimed：首解只破單次；第 5 條起 Ao5 首次可算即算最佳',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      const first = r.addTimed(4, 4, 2, 9000, 9, false);
      if (first.item.time_ms !== 9000) throw new Error('應正常入庫');
      if (!first.pb.single) throw new Error('首解應破單次');
      if (first.pb.ao5 || first.pb.ao12) throw new Error('首解不足 5/12 次，不應破 Ao5/Ao12');
      for (let i = 0; i < 3; i++) r.addTimed(4, 4, 2, 9500, 9, false); // 第 2~4 條
      const fifth = r.addTimed(4, 4, 2, 9500, 9, false); // 第 5 條：Ao5 首次可算
      if (fifth.pb.single) throw new Error('9500 未破 9000，不應報單次');
      if (!fifth.pb.ao5) throw new Error('第 5 條 Ao5 首次可算，應算最佳（原版同語義）');
      if (fifth.pb.ao12) throw new Error('不足 12 次不應破 Ao12');
    },
  },
  {
    name: 'addTimed：更慢的成績與 DNF 都不算 PB',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      r.addTimed(4, 4, 2, 9000, 9, false);
      const slow = r.addTimed(4, 4, 2, 12000, 10, false);
      if (slow.pb.single || slow.pb.ao5) throw new Error('更慢不應算 PB');
      const dnf = r.addTimed(4, 4, 2, 1000, 8, true);
      if (dnf.pb.single || dnf.pb.ao5 || dnf.pb.ao12) throw new Error('DNF 不應算 PB');
      if (!dnf.item.dnf) throw new Error('DNF 標記應入庫');
    },
  },
  {
    name: 'addTimed：Ao5 創新低（單次未破）；第 13 條 Ao12 創新低',
    run() {
      globalThis.localStorage._d = {};
      const r = new Records();
      // 前 5 條最舊的是最大值 9000 → 第 5 行 Ao5 = 7000；加入 5500 後窗口均値 6166.67
      for (const ms of [9000, 5000, 6000, 7000, 8000]) r.addTimed(4, 4, 2, ms, 10, false);
      const a = r.addTimed(4, 4, 2, 5500, 10, false);
      if (!a.pb.ao5) throw new Error('Ao5 應創新低');
      if (a.pb.single) throw new Error('5500 未破 5000 的單次，不應報 PB');
      if (a.pb.ao12) throw new Error('不足 12 次不應破 Ao12');

      // Ao12：前 12 條（最舊 20000 是最大值）第 12 行 Ao12 = 8100；第 13 條 5000 → 7700
      globalThis.localStorage._d = {};
      const r2 = new Records();
      const first12 = [20000, 1000, ...new Array(9).fill(8000), 9000];
      if (first12.length !== 12) throw new Error('夾具應為 12 條');
      for (const ms of first12) r2.addTimed(4, 4, 2, ms, 10, false);
      const b = r2.addTimed(4, 4, 2, 5000, 10, false);
      if (!b.pb.ao12) throw new Error('Ao12 應創新低');
      if (b.pb.single) throw new Error('5000 未破 1000，不應報單次 PB');
    },
  },
];
