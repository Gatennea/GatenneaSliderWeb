// 一次性验证：教程解法回放（快照步进）的滑塊對齊是否正確。
// 不依賴 DOM，只讀 tutorialData 的快照並逐對檢查 alignSnapshots 的配對。
import { TUTORIAL_ARCHIVES, TUTORIAL_ORDER } from '../dist/tutorial/tutorialData.js';

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

function alignSnapshots(from, to) {
  const start = new Array(from.length);
  const end = new Array(from.length);
  const usedTo = new Array(to.length).fill(false);
  const unmatched = [];
  for (let i = 0; i < from.length; i++) {
    const f = from[i];
    let m = -1;
    for (let j = 0; j < to.length; j++) {
      if (!usedTo[j] && to[j][0] === f[0] && to[j][1] === f[1]) {
        m = j;
        break;
      }
    }
    if (m >= 0) {
      usedTo[m] = true;
      start[i] = [f[0], f[1]];
      end[i] = [to[m][0], to[m][1]];
    } else {
      unmatched.push(i);
    }
  }
  for (const i of unmatched) {
    let best = -1,
      bestD = Infinity;
    for (let j = 0; j < to.length; j++) {
      if (usedTo[j]) continue;
      const d = Math.abs(to[j][0] - from[i][0]) + Math.abs(to[j][1] - from[i][1]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      usedTo[best] = true;
      start[i] = [from[i][0], from[i][1]];
      end[i] = [to[best][0], to[best][1]];
    }
  }
  return { start, end };
}

const ARCHIVES = TUTORIAL_ARCHIVES;
let totalLevels = 0;
let okLevels = 0;
let failLevels = 0;
const fails = [];

for (const subId of TUTORIAL_ORDER) {
  const archive = ARCHIVES[subId];
  if (!archive || !Array.isArray(archive?.history?.snapshots) || archive.history.snapshots.length < 2) {
    continue; // 占位關或無解法，跳過
  }
  totalLevels++;
  const pz = archive.puzzle;
  const snaps = archive.history.snapshots.map((s) => snapshotBlocks(s));

  let levelOk = true;
  let movedBlocksMax = 0;
  for (let i = 1; i < snaps.length; i++) {
    const from = snaps[i - 1];
    const to = snaps[i];
    // 1) 滑塊數量必須一致
    if (from.length !== to.length) {
      levelOk = false;
      break;
    }
    const { start, end } = alignSnapshots(from, to);
    // 2) start 必須與 from 逐個相等（對齊到的索引順序不變）
    for (let k = 0; k < from.length; k++) {
      if (start[k][0] !== from[k][0] || start[k][1] !== from[k][1]) {
        levelOk = false;
        break;
      }
    }
    if (!levelOk) break;
    // 3) end 的多重集必須等於 to 的多重集（雙射）
    const toKey = to.map((p) => `${p[0]}:${p[1]}`).sort().join('|');
    const endKey = end.map((p) => `${p[0]}:${p[1]}`).sort().join('|');
    if (toKey !== endKey) {
      levelOk = false;
      break;
    }
    // 4) 統計移動的滑塊數（期望為 1，偏離則記錄）
    let moved = 0;
    for (let k = 0; k < from.length; k++) {
      if (start[k][0] !== end[k][0] || start[k][1] !== end[k][1]) moved++;
    }
    if (moved > movedBlocksMax) movedBlocksMax = moved;
  }

  // 5) 末態應為「齊整矩形」m×n（即原版存檔殺青態）
  const last = snaps[snaps.length - 1];
  const expect = pz.m * pz.n;
  const lastOk = last.length === expect;

  if (levelOk && lastOk) {
    okLevels++;
    if (movedBlocksMax > 1) {
      fails.push(`${subId}: WARN movedBlocksMax=${movedBlocksMax} (非單塊移動，仍可回放但視覺略有跳變)`);
    }
  } else {
    failLevels++;
    fails.push(`${subId}: FAIL levelOk=${levelOk} lastOk=${lastOk}`);
  }
}

console.log(`總可回放關卡：${totalLevels}`);
console.log(`通過：${okLevels}`);
console.log(`失敗：${failLevels}`);
if (fails.length) {
  console.log('--- 詳情 ---');
  for (const f of fails) console.log(f);
} else {
  console.log('全部對齊正確 ✔');
}
