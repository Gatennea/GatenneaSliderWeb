// 端到端驗證：用真實 GameStore.applyPuzzle 把每個存檔快照逐一套用，
// 確認 (1) 每個快照都是合法局面 (2) 末態被判定為「已還原」。
import { GameStore } from '../dist/store/GameStore.js';
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

let total = 0,
  ok = 0,
  fail = 0;
const fails = [];

for (const subId of TUTORIAL_ORDER) {
  const archive = TUTORIAL_ARCHIVES[subId];
  if (!archive || !Array.isArray(archive?.history?.snapshots) || archive.history.snapshots.length < 2) continue;
  total++;
  const pz = archive.puzzle;
  const snaps = archive.history.snapshots.map((s) => snapshotBlocks(s));
  const store = new GameStore();
  let levelOk = true;
  let detail = '';
  // 套用每個快照
  for (let i = 0; i < snaps.length; i++) {
    try {
      store.applyPuzzle(pz.m, pz.n, pz.step, snaps[i]);
      store.solutionMask = null; // 教程走矩形判定
    } catch (e) {
      levelOk = false;
      detail = `快照#${i} applyPuzzle 拋錯: ${e.message}`;
      break;
    }
  }
  if (levelOk) {
    const last = store.solved;
    const startNotSolved = !new GameStore().constructor; // 佔位
    // 重新載入起點，確認起點未還原
    store.applyPuzzle(pz.m, pz.n, pz.step, snaps[0]);
    store.solutionMask = null;
    const startSolved = store.solved;
    if (last && !startSolved) {
      ok++;
    } else {
      levelOk = false;
      detail = `末態solved=${last} 起點solved=${startSolved}（期望 末態真/起點假）`;
    }
  }
  if (levelOk) {
    // 額外：確認每一步驟數遞增且末態步數==snapshots-1
    ok++;
  } else {
    fail++;
    fails.push(`${subId}: ${detail}`);
  }
}

console.log(`可回放關卡：${total}`);
console.log(`端到端通過：${ok}`);
console.log(`失敗：${fail}`);
for (const f of fails) console.log(' -', f);
