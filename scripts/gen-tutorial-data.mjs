/**
 * 一次性生成腳本：把原版 GatenneaSlider 的新手教程數據
 * （beginner_archive/*.json + gui/tutorial_texts.json）轉成網頁版可直接 import 的
 * src/tutorial/tutorialData.ts。
 *
 * 為什麼不直接 fetch JSON：網頁版是 file:// 雙擊打開的單文件 app.js，
 * 執行期無法 fetch 本地 JSON。把數據內聯成 TS 常量最穩。
 *
 * 用法（可選 SRC 參數指向原版倉庫）：
 *   node scripts/gen-tutorial-data.mjs [原版倉庫路徑]
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = process.argv[2]
  || 'E:/program_project/other/wkbddtest/GatenneaSlider';

const archiveDir = path.join(src, 'beginner_archive');
const textsPath = path.join(src, 'gui', 'tutorial_texts.json');

if (!fs.existsSync(archiveDir)) {
  console.error(`[gen] 找不到存檔目錄：${archiveDir}`);
  process.exit(1);
}
if (!fs.existsSync(textsPath)) {
  console.error(`[gen] 找不到文案：${textsPath}`);
  process.exit(1);
}

const texts = JSON.parse(fs.readFileSync(textsPath, 'utf8'));

/** 讀取所有 archive，key 為檔名（去副名），如 '1' / '2.1'。 */
const archives = {};
for (const f of fs.readdirSync(archiveDir).sort()) {
  if (!f.endsWith('.json')) continue;
  const id = f.slice(0, -5);
  const json = JSON.parse(fs.readFileSync(path.join(archiveDir, f), 'utf8'));
  archives[id] = json;
}

/** 構建關卡層級：levels[] 內含 sublevels[]，每個 sublevel 指向一個 archiveId。 */
const levelIds = ['1', '2', '3', '4', '5', '6'];
const levels = [];
for (const lid of levelIds) {
  const L = texts.levels?.[lid];
  if (!L) continue;
  const sublevels = [];
  if (L.steps) {
    // 第 1 關：單一關卡，本身帶 7 步引導
    sublevels.push({
      id: lid,
      title: L.title,
      guidance: null,
      steps: L.steps,
      archiveId: lid,
      teaching: true,
    });
  } else {
    const subIds = Object.keys(L.sublevel_titles || {});
    for (const sid of subIds) {
      sublevels.push({
        id: sid,
        title: L.sublevel_titles[sid],
        guidance: L.sublevels?.[sid] ?? '',
        steps: null,
        archiveId: sid,
        teaching: false,
      });
    }
  }
  levels.push({
    id: lid,
    title: L.title,
    complete_notify: L.complete_notify ?? '过关！',
    solve_tail: L.solve_tail ?? '',
    sublevels,
  });
}

// 攤平成有序序列（用於解鎖鏈：後一個 sublevel 依賴前一個完成）
const order = [];
for (const lv of levels) for (const sub of lv.sublevels) order.push(sub.id);

// 剝離執行期讀不到的欄位。網頁版「查看解法」已改為「逐快照重放」
// （見 src/feature/tutorial.ts），move_info / moves 兩個欄位沒有任何程式碼讀取，
// 卻佔了存檔資料約一半體積。原版 JSON 仍在，隨時可重新生成回來。
const DEAD_SNAP_FIELDS = ['move_info', 'moves'];
let strippedFields = 0;
for (const a of Object.values(archives)) {
  const snaps = a?.history?.snapshots;
  if (!Array.isArray(snaps)) continue;
  for (const s of snaps) {
    if (!s || typeof s !== 'object') continue;
    for (const f of DEAD_SNAP_FIELDS) {
      if (f in s) {
        delete s[f];
        strippedFields++;
      }
    }
  }
}

/**
 * 存檔資料以「緊湊 JSON 字串」內聯、啟動時 JSON.parse，而非直接寫成物件字面量。
 * 原因：物件字面量會被 tsc 以縮排形式展開（實測 882KB 的資料膨脹成約 1.6MB 的 dist），
 * 改成字串後檔案體積就等於緊湊 JSON 本身，且 JSON.parse 走原生解析器，比解析
 * 巨型物件字面量更快。
 */
const archivesCompact = JSON.stringify(archives);

// bundle.mjs 用模板字串拼出 app.js，若資料含反引號會破壞輸出語法；
// 反引號無法在 JSON 字串內跳脫，故這裡直接攔下並提示改換編碼方式。
if (archivesCompact.includes('`')) {
  console.error('[gen] 存檔資料含反引號，會破壞 bundle.mjs 的模板字串輸出，請改採其他編碼');
  process.exit(1);
}

const payload = `/**
 * 新手教程數據（由 scripts/gen-tutorial-data.mjs 自動生成，來源為原版 GatenneaSlider）。
 * 內聯以避免 file:// 下 fetch 本地 JSON 失敗。請勿手動編輯。
 *
 * - TUTORIAL_TEXTS：原版 gui/tutorial_texts.json（含 prompt / level_select / score / 各關文案）
 * - TUTORIAL_LEVELS：關卡層級結構（levels → sublevels），每個 sublevel 指向一個 archiveId
 * - TUTORIAL_ARCHIVES：各關存檔（與 GameStore.deserialize 相容的 {version,puzzle,step_count,history}）
 *   其中 snapshots 為「解法序列」：snapshot[0] 是起始亂局，snapshot[last] 是已還原的目標；
 *   「查看解法」即依序把這些快照播一遍。
 *   體積佔 app.js 絕大部分，故以緊湊 JSON 字串內聯（見生成腳本註解），解析後結構不變。
 */

export const TUTORIAL_TEXTS = ${JSON.stringify(texts, null, 2)};

export const TUTORIAL_LEVELS = ${JSON.stringify(levels, null, 2)};

/** 攤平後的有序 sublevel id 列表（解鎖鏈順序）。 */
export const TUTORIAL_ORDER = ${JSON.stringify(order, null, 2)};

export const TUTORIAL_ARCHIVES = JSON.parse(${JSON.stringify(archivesCompact)});
`;

const outDir = path.join(root, 'src', 'tutorial');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'tutorialData.ts');
fs.writeFileSync(outFile, payload, 'utf8');
console.log(`[gen] 已生成 ${path.relative(root, outFile)}`);
console.log(`[gen] levels=${levels.length} sublevels=${order.length} archives=${Object.keys(archives).length}`);
console.log(
  `[gen] 已剝離 ${strippedFields} 個未使用欄位（${DEAD_SNAP_FIELDS.join('/')}）；`
  + `存檔緊湊化後 ${(archivesCompact.length / 1024).toFixed(1)} KB`,
);

// 簡單健全性檢查：每個 sublevel 的 archiveId 都要有對應存檔
const missing = [];
for (const lid of levelIds) {
  const L = texts.levels?.[lid];
  if (!L) continue;
  const ids = L.steps ? [lid] : Object.keys(L.sublevel_titles || {});
  for (const id of ids) if (!archives[id]) missing.push(id);
}
if (missing.length) {
  console.warn(`[gen] 警告：以下 sublevel 缺少對應存檔：${missing.join(', ')}`);
}
