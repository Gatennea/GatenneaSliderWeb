/**
 * 打包器保險（scripts/bundle-core.mjs）。
 *
 * 以前踩過兩次的坑：寫了它認不得的 import/export 寫法時，舊版會**默默把那行留在
 * IIFE 裡**，構建照樣說成功，出來的 app.js 一開就是 SyntaxError。這組測試把每種
 * 踩坑寫法都丟進去，要求打包器必須**報錯、且不寫出任何檔案**。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { BundleError, composeBundle } from '../scripts/bundle-core.mjs';

function tmpDist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-guard-'));
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(dir, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return dir.replace(/\\/g, '/');
}

/** 斷言打包失敗（且訊息提到某個關鍵字） */
function expectBundleError(files, keyword, label) {
  const dir = tmpDist(files);
  const entry = `${dir}/main.js`;
  let err = null;
  try {
    composeBundle({ entry });
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error(`${label}：預期要報錯，卻打包成功了`);
  if (!(err instanceof BundleError)) throw new Error(`${label}：拋出的不是 BundleError：${err.message}`);
  if (!err.message.includes(keyword)) {
    throw new Error(`${label}：錯誤訊息應提到「${keyword}」，實際：${err.message}`);
  }
}

const cases = [
  {
    name: '正常專案：能組出可執行的 IIFE',
    run() {
      const dir = tmpDist({
        'main.js': [
          "import { hello } from './lib.js';",
          'console.log(hello());',
          'export { main };',
          'function main() { return hello(); }',
        ].join('\n'),
        'lib.js': [
          'export const hello = () => 1;',
          'export function hi() { return 2; }',
        ].join('\n'),
      });
      const { code, modules } = composeBundle({ entry: `${dir}/main.js` });
      if (modules !== 2) throw new Error(`模組數應為 2，實際 ${modules}`);
      new vm.Script(code); // 整包必須能編譯
    },
  },
  {
    name: '✘ 再導出 export { X } from … 必須報錯（舊版會靜默產出壞檔）',
    run() {
      expectBundleError(
        {
          'main.js': "export { hello } from './lib.js';\nconsole.log(hello());",
          'lib.js': 'export const hello = () => 1;',
        },
        '再導出',
        '再導出',
      );
    },
  },
  {
    // 實測：舊正則裡的 \s* 其實能跨行，所以多行 import 恰好能被吃下，不必擋。
    // 真正漏網的是**沒寫結尾分號**的 import —— 那會原樣留進 IIFE。
    name: '✘ 缺結尾分號的 import 必須報錯（舊版會靜默保留這行）',
    run() {
      expectBundleError(
        {
          'main.js': "import { hello } from './lib.js'\nconsole.log(hello());",
          'lib.js': 'export const hello = () => 1;',
        },
        '單行',
        '缺分號 import',
      );
    },
  },
  {
    name: '✔ 多行 import：\s* 能跨行匹配，照常打包成功',
    run() {
      const dir = tmpDist({
        'main.js': "import {\n  hello\n} from './lib.js';\nconsole.log(hello());",
        'lib.js': 'export const hello = () => 1;',
      });
      const { code } = composeBundle({ entry: `${dir}/main.js` });
      new vm.Script(code);
      if (code.includes('import ')) throw new Error('多行 import 沒被改寫掉');
    },
  },
  {
    name: '✘ 預設 import / export default 必須報錯',
    run() {
      expectBundleError(
        {
          'main.js': "import hello from './lib.js';\nconsole.log(hello());",
          'lib.js': 'const hello = () => 1;\nexport default hello;',
        },
        '預設',
        '預設導入',
      );
    },
  },
  {
    name: '✘ 動態 import() 必須報錯',
    run() {
      expectBundleError(
        {
          'main.js': "import('./lib.js').then((m) => console.log(m));",
          'lib.js': 'export const hello = () => 1;',
        },
        '動態',
        '動態 import',
      );
    },
  },
  {
    name: '✘ import 指到不存在的檔案：報誰 import 了誰，而不是丟 ENOENT',
    run() {
      expectBundleError(
        { 'main.js': "import { hello } from './nope.js';\nconsole.log(hello());" },
        '模組不存在',
        '缺檔案',
      );
    },
  },
  {
    name: '✘ 循環依賴必須報錯（舊版會無限遞歸爆棧）',
    run() {
      expectBundleError(
        {
          'main.js': "import { b } from './b.js';\nconsole.log(b());",
          'b.js': "import { c } from './c.js';\nexport const b = () => c();",
          'c.js': "import { b } from './b.js';\nexport const c = () => b();",
        },
        '循環依賴',
        '循環依賴',
      );
    },
  },
  {
    name: '✘ 來源本身有語法錯誤：必須報錯並指出是哪個檔案',
    run() {
      expectBundleError(
        {
          'main.js': "import { hello } from './lib.js';\nconsole.log(hello());",
          'lib.js': 'export const hello = ( => 1;',
        },
        'lib.js',
        '來源語法錯誤',
      );
    },
  },
  {
    name: '✔ 尾隨逗號 export { A, B, }：容錯（舊版會生成 return {A, B, ,} 直接炸）',
    run() {
      const dir = tmpDist({
        'main.js': "import { hello } from './lib.js';\nconsole.log(hello());",
        'lib.js': 'const hello = () => 1;\nconst hi = () => 2;\nexport { hello, hi, };',
      });
      const { code } = composeBundle({ entry: `${dir}/main.js` });
      new vm.Script(code);
      if (code.includes(', ,')) throw new Error('產物仍出現連續逗號');
    },
  },
  {
    name: '✔ 真實專案（dist/）打包成功且產物與磁碟上的 app.js 一致',
    run() {
      const root = path.resolve(import.meta.dirname, '..').replace(/\\/g, '/');
      const { code } = composeBundle({ entry: `${root}/dist/main.js` });
      const onDisk = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
      if (code !== onDisk) {
        throw new Error(
          '重打包結果與 app.js 不一致 —— 通常是改了打包器卻沒重新 npm run build',
        );
      }
    },
  },
];

export { cases };
