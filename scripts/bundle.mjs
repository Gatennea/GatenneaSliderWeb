/**
 * 極簡 in-process 打包器 CLI：把已編譯的 dist/*.js 合成單一 app.js（IIFE）。
 *
 * 用途：受限環境無法跑 esbuild/vite，此腳本不 spawn 任何子進程；
 * 產出的 app.js 為「非 module」腳本，可被 file:// 直接開啟（index.html 使用）。
 *
 * 只支援本專案編譯輸出的語法子集：
 *   - 單行 named import：import { A, B as C } from './rel.js';
 *   - 頂層 export class/function/const（type/interface 已被 tsc 抹除）
 *
 * 保險做在 scripts/bundle-core.mjs：不支援的寫法、語法錯誤、找不到的檔案、循環依賴
 * 都會在**寫出 app.js 之前**報錯並中止，不會再交付一個「構建成功但打不開」的產物。
 */

import fs from 'node:fs';
import path from 'node:path';
import { BundleError, composeBundle } from './bundle-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const entry = path.join(root, 'dist', 'main.js');
const outFile = path.join(root, 'app.js');

if (!fs.existsSync(entry)) {
  console.error('[bundle] 找不到 dist/main.js，請先執行 npm run build（tsc）。');
  process.exit(1);
}

try {
  const { code, warnings, modules } = composeBundle({ entry: entry.replace(/\\/g, '/') });
  for (const w of warnings) console.warn(`[bundle] 警告：${w}`);
  fs.writeFileSync(outFile, code, 'utf8');
  console.log(
    `[bundle] 已生成 ${path.relative(root, outFile)}（${code.length} bytes，${modules} 個模組）`,
  );
} catch (e) {
  if (e instanceof BundleError) {
    console.error(`\n[bundle] ✘ 打包中止，未寫出 app.js：\n  ${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
