/**
 * 教程關卡資料完整性測試
 *
 * 第 6 章（6.1~6.5）是網頁版自製的，原版 beginner_archive 裡原本是空的。
 * 它由 scripts/gen-ch6-levels.mjs 以「每步都可逆的隨機走法」生成，
 * 生成器本身雖然有自校驗，但資料一旦進了 tutorialData.ts 就可能被誤改，
 * 所以這裡再上一道常駐保險：資料層面就要能證明「有解、且真的一步一步走得回去」。
 *
 * 另外也守住前 5 章：匯入原版存檔的流程若壞掉（例如有人重跑生成腳本時
 * 原版路徑不對），這裡要立刻炸出來，而不是等到玩家點開才發現關卡消失。
 */
import {
  TUTORIAL_ARCHIVES as ARCHIVES,
  TUTORIAL_ORDER as ORDER,
  TUTORIAL_LEVELS as LEVELS,
} from '../dist/tutorial/tutorialData.js';
import { enumerateMoves, stateFromBlocks, isSolvedState } from '../dist/solver/model.js';

/** 快照 {matrix, bounds} → 絕對座標 blocks。與 tutorial.ts 的 snapshotBlocks 同義。 */
function snapshotBlocks(snap) {
  const out = [];
  const m = snap?.matrix;
  const b = snap?.bounds;
  if (!Array.isArray(m) || !b) return out;
  for (let r = 0; r < m.length; r++) {
    const row = m[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1) out.push([b.min_row + r, b.min_col + c]);
    }
  }
  return out;
}

function sameState(a, b) {
  if (a.size !== b.size) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}

/** a、b 是否恰好相差一個合法走法。 */
function differByOneMove(a, b, step) {
  for (const mv of enumerateMoves(a, step)) {
    if (sameState(mv.next, b)) return true;
  }
  return false;
}

export const cases = [
  {
    name: '教程結構：6 章 24 關、解鎖鏈有序',
    run() {
      if (LEVELS.length !== 6) throw new Error(`章數 ${LEVELS.length} ≠ 6`);
      if (ORDER.length !== 24) throw new Error(`關卡數 ${ORDER.length} ≠ 24`);
      // 每關都得有存檔：原版給了 1~5 章，第 6 章由網頁版自製補上
      const missing = ORDER.filter((id) => !ARCHIVES[id]);
      if (missing.length) throw new Error(`缺少存檔的關卡：${missing.join(', ')}`);
    },
  },

  {
    name: '第 6 章：5 關都有標題與引導（不再是佔位的省略號）',
    run() {
      const ch6 = LEVELS.find((l) => String(l.id) === '6');
      if (!ch6) throw new Error('找不到第 6 章');
      if (ch6.sublevels.length !== 5) throw new Error(`第 6 章 sublevel 數 ${ch6.sublevels.length} ≠ 5`);
      for (const sub of ch6.sublevels) {
        if (!sub.title || sub.title.includes('...')) throw new Error(`${sub.id} 標題仍是佔位：${sub.title}`);
        if (!sub.guidance || sub.guidance.includes('...')) throw new Error(`${sub.id} 引導仍是佔位：${sub.guidance}`);
        if (!ARCHIVES[sub.archiveId]) throw new Error(`${sub.id} 沒有對應存檔`);
      }
    },
  },

  {
    name: '第 6 章：每關快照數 = 解法步數 + 1，且 puzzle 欄位齊全',
    run() {
      for (const id of ['6.1', '6.2', '6.3', '6.4', '6.5']) {
        const a = ARCHIVES[id];
        const pz = a?.puzzle;
        if (!pz || !pz.m || !pz.n || !pz.step) throw new Error(`${id} puzzle 欄位不完整`);
        const snaps = a.history?.snapshots ?? [];
        if (snaps.length !== a.step_count + 1) {
          throw new Error(`${id} 快照數 ${snaps.length} ≠ step_count+1 (${a.step_count + 1})`);
        }
      }
    },
  },

  {
    name: '第 6 章：相鄰快照恰好相差一個合法走法（解法是真的走得動）',
    run() {
      for (const id of ['6.1', '6.2', '6.3', '6.4', '6.5']) {
        const a = ARCHIVES[id];
        const { m, n, step } = a.puzzle;
        const states = a.history.snapshots.map((s) => stateFromBlocks(snapshotBlocks(s)));
        for (let i = 0; i + 1 < states.length; i++) {
          if (!differByOneMove(states[i], states[i + 1], step)) {
            throw new Error(`${id} 快照 ${i}→${i + 1} 不是一個合法走法`);
          }
        }
      }
    },
  },

  {
    name: '第 6 章：起局是亂的、末態已還原、中途未提前還原',
    run() {
      for (const id of ['6.1', '6.2', '6.3', '6.4', '6.5']) {
        const a = ARCHIVES[id];
        const { m, n } = a.puzzle;
        const states = a.history.snapshots.map((s) => stateFromBlocks(snapshotBlocks(s)));
        if (isSolvedState(states[0], m, n)) throw new Error(`${id} 起局就已經是還原態`);
        const last = states[states.length - 1];
        if (!isSolvedState(last, m, n)) throw new Error(`${id} 末態不是還原態`);
        for (let i = 1; i + 1 < states.length; i++) {
          if (isSolvedState(states[i], m, n)) throw new Error(`${id} 快照 ${i} 中途就先還原了（贅步）`);
        }
      }
    },
  },

  {
    name: '全部 24 關：每快照的塊數都等於 m×n（沒有掉塊或憑空多塊）',
    run() {
      for (const id of ORDER) {
        const a = ARCHIVES[id];
        if (!a) continue;
        const { m, n } = a.puzzle;
        a.history.snapshots.forEach((s, i) => {
          const cnt = snapshotBlocks(s).length;
          if (cnt !== m * n) throw new Error(`${id} 快照${i} 塊數 ${cnt} ≠ ${m * n}`);
        });
      }
    },
  },
];
