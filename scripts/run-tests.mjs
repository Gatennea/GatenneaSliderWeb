/**
 * 零依賴測試執行器（in-process，避免受限環境下 spawn 被拒）。
 * 用法：node scripts/run-tests.mjs [測試檔.mjs ...]
 */
import { cases as matrixCases } from '../tests/SliderMatrix.test.mjs';
import { cases as hitCases } from '../tests/hit.test.mjs';
import { cases as renderCases } from '../tests/render.test.mjs';
import { cases as cmdCases } from '../tests/commandbus.test.mjs';
import { cases as saveCases } from '../tests/save.test.mjs';
import { cases as timerCases } from '../tests/timer.test.mjs';
import { cases as recordCases } from '../tests/records.test.mjs';
import { cases as popupCases } from '../tests/solvedPopup.test.mjs';
import { cases as shuffleCases } from '../tests/shuffle.test.mjs';
import { cases as numberedCases } from '../tests/numbered.test.mjs';
import { cases as bundleCases } from '../tests/bundle.test.mjs';
import { cases as solverCases } from '../tests/solver.test.mjs';
import { cases as tutorialCases } from '../tests/tutorial.test.mjs';
import { cases as vkCases } from '../tests/virtualKeyboard.test.mjs';
import { cases as ctrlCases } from '../tests/controlModes.test.mjs';
import { cases as changelogCases } from '../tests/changelog.test.mjs';
import { cases as dragFollowCases } from '../tests/dragFollow.test.mjs';

const allSuites = [
  { file: 'SliderMatrix.test.mjs', name: 'SliderMatrix/GameHistory', cases: matrixCases },
  { file: 'hit.test.mjs', name: '命中測試 (BoardRenderer)', cases: hitCases },
  { file: 'render.test.mjs', name: '渲染選中效果 (BoardRenderer)', cases: renderCases },
  { file: 'commandbus.test.mjs', name: 'CommandBus 整合 (M3)', cases: cmdCases },
  { file: 'save.test.mjs', name: '存檔/導入/切換 (M4)', cases: saveCases },
  { file: 'timer.test.mjs', name: '計時器 (M5)', cases: timerCases },
  { file: 'records.test.mjs', name: '成績 (M6)', cases: recordCases },
  { file: 'solvedPopup.test.mjs', name: '棋盤標記 / 復原彈窗', cases: popupCases },
  { file: 'shuffle.test.mjs', name: '安全打亂（保證可還原）', cases: shuffleCases },
  { file: 'numbered.test.mjs', name: '數字形態 / 引導局面 (M7)', cases: numberedCases },
  { file: 'bundle.test.mjs', name: '打包器保險 (bundle)', cases: bundleCases },
  { file: 'solver.test.mjs', name: '求解器（聚攏 + 填洞補缺）', cases: solverCases },
  { file: 'tutorial.test.mjs', name: '教程關卡資料完整性', cases: tutorialCases },
  { file: 'virtualKeyboard.test.mjs', name: '虛擬鍵盤（佈局/夾邊/粘滯連播）', cases: vkCases },
  { file: 'controlModes.test.mjs', name: '控制方式解耦（原版五開關）', cases: ctrlCases },
  { file: 'changelog.test.mjs', name: '版本公告（更新預告）', cases: changelogCases },
  { file: 'dragFollow.test.mjs', name: '拖拽跟隨（一邊拖一邊動 + 越界判定）', cases: dragFollowCases },
];

// 用法聲明一直支持「只跑指定檔」，此前卻從未實現（排查 flaky 時以為在單跑某套件，其實跑了全量）。
// 按 basename 匹配，方便 `node scripts/run-tests.mjs tests/dragFollow.test.mjs`。
const only = process.argv.slice(2).map((a) => a.replace(/^.*[\\/]/, ''));
const suites = only.length === 0
  ? allSuites
  : allSuites.filter((s) => only.includes(s.file));
if (suites.length === 0) {
  console.error(`沒有匹配的測試套件：${only.join(', ')}`);
  console.error(`可用：${allSuites.map((s) => s.file).join(' ')}`);
  process.exitCode = 1;
}

let passed = 0;
let failed = 0;

for (const suite of suites) {
  console.log(`\n== ${suite.name} ==`);
  for (const c of suite.cases) {
    try {
      await c.run();
      passed += 1;
      console.log(`  ✔ ${c.name}`);
    } catch (e) {
      failed += 1;
      console.log(`  ✘ ${c.name}`);
      console.log(`    ${e && e.message ? e.message : e}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
