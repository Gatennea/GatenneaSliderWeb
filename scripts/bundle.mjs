/**
 * 極簡 in-process 打包器：把已編譯的 dist/*.js 合成單一 app.js（IIFE）。
 *
 * 用途：受限環境無法跑 esbuild/vite，此腳本不 spawn 任何子進程；
 * 產出的 app.js 為「非 module」腳本，可被 file:// 直接開啟（index.html 使用）。
 *
 * 只支援本專案編譯輸出的語法子集：
 *   - 單行 named import：import { A, B as C } from './rel.js';
 *   - 頂層 export class/function/const（type/interface 已被 tsc 抹除）
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const entry = path.join(distDir, 'main.js');
const outFile = path.join(root, 'app.js');

if (!fs.existsSync(entry)) {
  console.error('[bundle] 找不到 dist/main.js，請先執行 npm run build（tsc）。');
  process.exit(1);
}

/** 統一正斜線，避免 Windows 反斜線在輸出與解析時不一致 */
const norm = (p) => p.replace(/\\/g, '/');

/** 解析 import 語句為 { bindings: [local, imported], spec } */
function parseImports(code) {
  const imports = [];
  const re = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];\s*$/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const bindings = m[1].split(',').map((s) => {
      const pair = s.trim().split(/\s+as\s+/);
      return pair.length === 2
        ? { local: pair[1].trim(), imported: pair[0].trim() }
        : { local: pair[0].trim(), imported: pair[0].trim() };
    });
    imports.push({ full: m[0], bindings, spec: m[2] });
  }
  return imports;
}

/** 把 import 行替換為 require + 解構 */
function rewriteImports(code, imports) {
  let out = code;
  for (const im of imports) {
    const destructure = im.bindings
      .map((b) => (b.local === b.imported ? b.local : `${b.imported}: ${b.local}`))
      .join(', ');
    out = out.replace(im.full, `const { ${destructure} } = require(${JSON.stringify(im.spec)});`);
  }
  return out;
}

/** 移除 export 修飾、收集導出名；回傳 { code, exported } */
function rewriteExports(code) {
  const exported = [];

  // export class X / export function X / export const X...
  code = code.replace(
    /^export\s+(async\s+)?(class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (match, asyncKw, kind, name) => {
      exported.push(name);
      return `${asyncKw || ''}${kind} ${name}`;
    },
  );

  // export { A, B };
  const reExportRe = /^export\s*\{([^}]+)\}\s*;\s*$/gm;
  code = code.replace(reExportRe, (m, list) => {
    list.split(',').forEach((s) => {
      const name = s.trim().split(/\s+as\s+/)[0].trim();
      exported.push(name);
    });
    return '';
  });

  return { code, exported };
}

const records = new Map(); // abs -> record
let counter = 0;

function absFromSpec(fromFile, spec) {
  return norm(path.normalize(path.join(path.dirname(fromFile), spec)));
}

function register(absRaw) {
  const abs = norm(absRaw);
  if (records.has(abs)) return records.get(abs);
  const id = `m${counter++}`;
  const src = fs.readFileSync(abs, 'utf8');
  const imports = parseImports(src);
  let code = rewriteImports(src, imports);
  const { code: code2, exported } = rewriteExports(code);
  return records.set(abs, { id, abs, code: code2, exported, imports }).get(abs);
}

function build(abs) {
  const rec = register(abs);
  if (rec._built) return rec;
  rec._built = true;
  for (const im of rec.imports) {
    build(absFromSpec(abs, im.spec));
  }
  return rec;
}

build(entry);

// 依賴序不影響執行（require 惰性載入），但保持穩定輸出：依 id 排序
const recs = [...records.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

const parts = recs.map((rec) => {
  const exportedObj = rec.exported.length
    ? `return { ${rec.exported.join(', ')} };`
    : 'return {};';
  return `${JSON.stringify(rec.id)}: function (require) {\n${rec.code}\n${exportedObj}\n}`;
});

const resolveEntries = recs
  .map((rec) => `${JSON.stringify(rec.abs)}: ${JSON.stringify(rec.id)}`)
  .join(',\n    ');

const bundle = `/* 由 scripts/bundle.mjs 自動生成；來源為已編譯的 dist/。請勿手動編輯。 */
(function () {
  var __modules = { ${parts.join(',\n    ')} };
  var __cache = {};
  function __load(id) {
    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];
    var fn = __modules[id];
    if (!fn) throw new Error('module not found: ' + id);
    var require = function (spec) { return __load(__resolvedId(id, spec)); };
    return __cache[id] = fn(require);
  }
  var __resolve = { ${resolveEntries} };
  function __resolvedId(fromId, spec) {
    var fromAbs = null;
    for (var k in __resolve) { if (__resolve[k] === fromId) { fromAbs = k; break; } }
    var parts = fromAbs.split('/');
    parts.pop();
    var specParts = spec.split('/');
    for (var i = 0; i < specParts.length; i++) {
      if (specParts[i] === '.' || specParts[i] === '') continue;
      if (specParts[i] === '..') parts.pop();
      else parts.push(specParts[i]);
    }
    var target = parts.join('/');
    var id = __resolve[target];
    if (!id) throw new Error('module not found: ' + spec + ' from ' + fromAbs);
    return id;
  }
  __load(${JSON.stringify(records.get(norm(entry)).id)});
})();
`;

fs.writeFileSync(outFile, bundle, 'utf8');
console.log(`[bundle] 已生成 ${path.relative(root, outFile)}（${bundle.length} bytes）`);
