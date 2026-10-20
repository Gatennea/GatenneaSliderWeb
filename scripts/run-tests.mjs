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
import { cases as shuffleCases } from '../tests/shuffle.test.mjs';
import { cases as numberedCases } from '../tests/numbered.test.mjs';
import { cases as bundleCases } from '../tests/bundle.test.mjs';
import { cases as solverCases } from '../tests/solver.test.mjs';

const suites = [
  { name: 'SliderMatrix/GameHistory', cases: matrixCases },
  { name: '命中測試 (BoardRenderer)', cases: hitCases },
  { name: '渲染選中效果 (BoardRenderer)', cases: renderCases },
  { name: 'CommandBus 整合 (M3)', cases: cmdCases },
  { name: '存檔/導入/切換 (M4)', cases: saveCases },
  { name: '計時器 (M5)', cases: timerCases },
  { name: '成績 (M6)', cases: recordCases },
  { name: '安全打亂（保證可還原）', cases: shuffleCases },
  { name: '數字形態 / 引導局面 (M7)', cases: numberedCases },
  { name: '打包器保險 (bundle)', cases: bundleCases },
  { name: '求解器（聚攏 + 填洞補缺）', cases: solverCases },
];

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
