/**
 * 打包核心（可由 CLI 與測試共用）。
 *
 * 本專案的 bundle 是自己寫的，只支援語法子集 —— 一旦有人（或 AI）寫了它認不得的
 * import/export 寫法，舊版的行為是**默默把那行留在 IIFE 裡面**，構建照樣報成功，
 * 產出的 app.js 一打開就是 SyntaxError。這個坑已經踩過兩次，故這裡做成「寧可報錯，
 * 也不產出壞檔」：
 *
 *   1. 每個模組：不支援的 import/export 寫法 → 報錯並指出檔案與行號 + 怎麼改
 *   2. 每個模組：改寫後用 vm.Script 真的編譯一次（不執行）→ 精確定位到是哪個檔案
 *   3. import 指到的檔案不存在 → 報「誰 import 了誰」，而不是丟原生 ENOENT
 *   4. 循環依賴 → 明確報出環（現行 require 實作遇到環會無限遞歸、直接爆棧）
 *   5. 整包：組好後再整體編譯一次才准寫出（兜底）
 *
 * 有了 2 與 5，就不需要在 build 後另外手敲 node --check（vm.Script 是同一套解析器）。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export class BundleError extends Error {}

/** 統一正斜線，避免 Windows 反斜線在輸出與解析時不一致 */
export const norm = (p) => p.replace(/\\/g, '/');

/** 解析 import 語句為 { bindings: [local, imported], spec }（只認單行具名 import） */
export function parseImports(code) {
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
export function rewriteImports(code, imports) {
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
export function rewriteExports(code) {
  const exported = [];

  code = code.replace(
    /^export\s+(async\s+)?(class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (match, asyncKw, kind, name) => {
      exported.push(name);
      return `${asyncKw || ''}${kind} ${name}`;
    },
  );

  const reExportRe = /^export\s*\{([^}]+)\}\s*;\s*$/gm;
  code = code.replace(reExportRe, (m, list) => {
    list.split(',').forEach((s) => {
      const name = s.trim().split(/\s+as\s+/)[0].trim();
      // 容錯：`export { A, B, };` 的尾隨逗號會 split 出空名字。以前這會生成
      // `return { A, B, , }` 直接炸 SyntaxError；這裡跳過空名（整包編譯仍會把關）。
      if (name) exported.push(name);
    });
    return '';
  });

  return { code, exported };
}

/**
 * 掃描「改寫完還留著的 import / export」——那些就是本打包器認不得的寫法。
 * dist 是 tsc 的平坦輸出，import/export 只出現在頂層，故用行首比對就夠。
 */
export function findResidualModuleSyntax(code) {
  const bad = [];
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!/^(import|export)\b/.test(trimmed)) continue;
    bad.push({ line: i + 1, text: trimmed, hint: hintFor(trimmed) });
  }
  return bad;
}

/** 針對常見踩坑寫法給人話提示 */
function hintFor(text) {
  if (/^export\s*\{[^}]*\}\s*from/.test(text)) {
    return '不支援「再導出」。改成先 import 再用不帶 from 的 `export { X };` 導出';
  }
  if (/^export\s*\*/.test(text)) return '不支援 export *，請逐名列在 export { … } 裡';
  if (/^export\s+default/.test(text)) return '不支援預設導出，請用具名導出';
  if (/^import\s*\*/.test(text)) return '不支援 import *，請用具名 import';
  if (/^import\s+[A-Za-z_$][\w$]*\s*(,|from)/.test(text)) {
    return '不支援預設 import，請用具名 import';
  }
  if (/^import\s*\{/.test(text)) {
    return '只支援**單行**具名 import；多行 import 請併成一行（也可能是少了結尾分號）';
  }
  if (/^import\s*\(/.test(text)) return '不支援動態 import()，請改用靜態具名 import';
  if (/^import\b/.test(text)) return '不支援這種 import 寫法，請用單行具名 import';
  return '不支援這種 export 寫法';
}

/** 用 Node 自己的解析器編譯一次（不執行），精確抓出語法錯誤 */
export function checkSyntax(label, code, wrapper = (c) => c) {
  try {
    new vm.Script(wrapper(code), { filename: label });
  } catch (e) {
    throw new BundleError(`語法檢查失敗：${label}\n    ${e.message}`);
  }
}

export function absFromSpec(fromFile, spec) {
  return norm(path.normalize(path.join(path.dirname(fromFile), spec)));
}

/**
 * 組裝整包。成功回傳 { code, warnings, modules }；任何問題都拋 BundleError。
 * @param {{distDir: string, entry: string}} opts
 */
export function composeBundle({ entry: rawEntry }) {
  const entry = norm(rawEntry);
  const warnings = [];
  const records = new Map();
  const visiting = [];
  let counter = 0;

  function register(absRaw) {
    const abs = norm(absRaw);
    if (records.has(abs)) return records.get(abs);

    if (!fs.existsSync(abs)) {
      const from = visiting.length ? visiting[visiting.length - 1] : entry;
      throw new BundleError(
        `模組不存在：${abs}\n    由 ${from} import 進來（spec 必須是 './rel.js' 這種相對路徑，且帶 .js 後綴）`,
      );
    }

    const id = `m${counter++}`;
    const src = fs.readFileSync(abs, 'utf8');
    const imports = parseImports(src);

    visiting.push(abs);
    let code = rewriteImports(src, imports);
    const { code: code2, exported } = rewriteExports(code);
    code = code2;

    // ① 不支援的寫法：改寫後還留著 import/export 一律報錯
    const residual = findResidualModuleSyntax(code);
    if (residual.length) {
      throw new BundleError(
        `${abs} 含本打包器不支援的模組語法（第 ${residual.map((r) => r.line).join('、')} 行）：\n`
          + residual.map((r) => `    第 ${r.line} 行：${r.text}\n      → ${r.hint}`).join('\n'),
      );
    }

    const rec = { id, abs, code, exported, imports };
    records.set(abs, rec);

    // ② 依賴存在性 + ③ 循環依賴
    for (const im of rec.imports) {
      const target = absFromSpec(abs, im.spec);
      if (visiting.includes(target)) {
        throw new BundleError(
          `循環依賴：${[...visiting, target].map((p) => path.basename(p)).join(' → ')}\n`
            + '    請把共用部分抽到第三個模組（本打包器的 require 不做環保護）',
        );
      }
      build(target);
    }
    visiting.pop();

    // ④ 每個模組單獨編譯一次，錯誤能精確定位到檔案
    checkSyntax(abs, rec.code, (c) => `(function (require) {\n${c}\n})`);

    if (rec.exported.length !== new Set(rec.exported).size) {
      warnings.push(`${abs} 有重複的導出名：${rec.exported.join(', ')}`);
    }
    return rec;
  }

  function build(abs) {
    const rec = register(abs);
    return rec;
  }

  const entryRec = register(entry);

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

  const code = `/* 由 scripts/bundle.mjs 自動生成；來源為已編譯的 dist/。請勿手動編輯。 */
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
  __load(${JSON.stringify(entryRec.id)});
})();
`;

  // ⑤ 整包兜底：再編譯一次才准寫出
  checkSyntax('app.js', code);

  return { code, warnings, modules: recs.length };
}
