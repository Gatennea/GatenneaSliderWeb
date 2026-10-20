# 構建與產物（`app.js`）踩坑筆記

> **這份文檔存在的理由**：改幾行源碼，`git diff` 卻跳出 `app.js` 數千行增刪，
> 看起來像把東西改壞了。其實多半是**無害的排版重排**。這件事被反覆查過，
> 每次都要從頭推理一遍很浪費，故寫在這裡。下次遇到先看本檔第 2 節。

## 1. 構建鏈路（30 秒版）

```
src/**/*.ts  --tsc-->  dist/**/*.js  --scripts/bundle.mjs-->  app.js（單檔 IIFE）
```

| 命令 | 作用 |
| --- | --- |
| `npm run build` | tsc 編譯到 `dist/`，再打包成 `app.js` |
| `npm test` | 跑 `scripts/run-tests.mjs`（in-process，無 spawn） |
| `npm run smoke` | 最小 DOM stub 在 Node 裡真跑一遍 `app.js`，抓 TDZ / 事件接線問題 |

`app.js` 是**產物，但必須入庫**——`game.html` 要能 file:// 雙擊打開，
不能依賴構建步驟，也不能用 `<script type="module">`（file:// 會被 CORS 擋）。

`scripts/bundle-core.mjs` 自帶五道關卡（殘留 import/export → 逐模組 `vm.Script` 編譯 →
缺檔案 → 循環依賴 → 整包兜底），任一不過就 exit 1 且**不覆蓋舊產物**。
所以「構建報成功」是可信的，**不必再手敲 `node --check`**。

## 2. ⚠️ 巨量 diff 是無害的（重點）

### 現象

改動 `src/` 幾行（哪怕只是加一個 import），`git diff app.js` 出現數千行
delete + insert（實測 +2895 / −2508），hunk 散佈在看似無關的位置
（`clampInt` 被刪、`ARROW_IMAGE` 整段重排、連 `TUTORIAL_ARCHIVES` 都動了）。

### 根因：模組 id 按**字符串**排序

`bundle-core.mjs` 的 `composeBundle` 裡，模組 id 由 **DFS 前序遍歷**分配
（`m0`、`m1`、`m2`…），最後輸出前按 **id 字符串**排序：

```js
const recs = [...records.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
```

字符串序是 `m0, m1, m10, m11, …, m19, m2, m20, m3…`，不是數字序。
→ 只要給任何一個模組新增或刪除 import，DFS 前序就變 → **所有 m 編號集體錯位**
→ body 排列順序整體重排 → diff 滿江紅。

也就是說：diff 的規模由「編號錯位」決定，與你改了多少邏輯**無關**。

### 為什麼無害：body 順序純屬排版

產物長這樣（`composeBundle` 尾部）：

```js
var __modules = { "m0": function (require) { … }, "m1": function (require) { … } };
function __load(id) {
  if (…__cache…) return __cache[id];
  var require = function (spec) { return __load(__resolvedId(id, spec)); };
  return __cache[id] = __modules[id](require);
}
__load("m0");
```

- 每個模組的 body 是一個**函數**，只定義、不執行；
- 真正執行發生在 `__load(id)`，且 body 裡的 `require(...)` 會**先把被依賴模組
  `__load` 完**再繼續。所以「誰排在前面」不影響求值順序，**只影響依賴被載入的先後**，
  而依賴是惰性載入的；
- `__resolve` 用**絕對路徑**做 key（不受 body 順序影響）。

結論：**body 順序變了 = 排版變了，語義不變。**
（唯一真正會出事的是循環依賴，而打包器在建構期就直接報錯拒絕產出。）

### 怎麼確認這次的巨量 diff 確實無害（三步）

1. **看 `src/` 的 diff**——真實改動永遠在這裡，`app.js` 只是它的影子：
   `git diff --stat -- src/`
2. **排除行尾噪音**再看 `app.js`（本機 `core.autocrlf=true`，CRLF/LF 混雜會把整個檔案刷成全量改動）：
   `git diff --ignore-cr-at-eol -- app.js`，或 `git add` 後 `git diff --cached`（會自動歸一化）
3. **真不放心就重建一次比對**：

```bash
git worktree add /tmp/head-check HEAD
cd /tmp/head-check
node <本專案絕對路徑>/node_modules/typescript/lib/tsc.js   # Windows 下 symlink node_modules 不生效
node scripts/bundle.mjs
git show HEAD:app.js > /tmp/in-repo.js && diff /tmp/in-repo.js app.js
```

只會有 `__resolve` 裡的絕對路徑不同（那是構建目錄決定的），其餘應完全一致。
實測 HEAD 的 `app.js` 與「HEAD 源碼重建」逐字節相同，可放心。

## 3. 同一條線上的其他小坑

| 坑 | 說明 |
| --- | --- |
| **bundle 報的「bytes」其實是字符數** | 中文註釋 3 字節/字，所以報出來的數比 `ls -l` 的磁盤字節數**少約 10%**。別拿這兩個數對比，會以為產物沒更新。 |
| **CRLF 行尾噪音** | 克隆出的倉庫工作區是 CRLF，用 Edit/Write 工具改過檔案後 `git diff` 會把整個檔案刷成全量改動。看真實改動用 `git diff --ignore-cr-at-eol`。檔案本身仍是純 CRLF（`d.count(b'\r\n') == d.count(b'\n')`），**不污染倉庫**。 |
| **Windows 下 worktree 裡 `ln -s node_modules` 無效** | 用主專案 tsc 的**絕對路徑**調用：`node E:/…/node_modules/typescript/lib/tsc.js` |
| **模組 body 頂層常量的求值順序** | 有人擔心 `BoardRenderer.js` 頂層 `const CELL = GEOMETRY.base_cell_size` 會不會因為 body 排在 theme 前面就取到 undefined。不會：body 執行時 `require` 已先把 theme `__load` 完（見第 2 節）。 |

## 4. 打包器認得的語法子集（寫新檔案前看）

`bundle-core.mjs` 只支援：

- ✅ **單行具名 import**：`import { A, B as C } from './rel.js';`（路徑必須帶 `.js`）
- ✅ 頂層具名 export：`export class/function/const/let/var X`，或 `export { X };`
- ❌ `import *` / 動態 `import()` / 多行 import / 預設 import / 預設導出
- ❌ **再導出** `export { X } from './y.js';`（會原樣殘留在 IIFE 裡 → 開檔直接 SyntaxError）
  → 改成「先 import，再 `export { X };`」
- ❌ `export { A, B, };` 的**尾隨逗號**（會 split 出空名字 → `return { A, B, , }` 炸掉）
  → 打包器現在會跳過空名，但仍別這麼寫
- ❌ 頂層 `await`、循環依賴

違規時構建會**報錯並指出檔案、行號、怎麼改**，不再默默產出壞檔（2026-10-19 起）。
`tests/bundle.test.mjs` 有 11 個用例守著這些規則，要加校驗就加在那裡。
