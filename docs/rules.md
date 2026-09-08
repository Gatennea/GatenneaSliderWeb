# 規則與移植對照（開發時查）

> 開發 `core/*` 時以本文件為準。內容來自 `readme.md` §2 與 `術語規定.md`，及 `game.py` / `history.py` / `gui/events.py` 的公開 API。
> 移植紀律：**核心邏輯不重寫，只做移植**。函數名與分支結構保持接近原版，任何「優化」都要能說出為什麼不違反規則與不變量。

---

## 1. 核心不變量

| 規則 | 內容 |
| --- | --- |
| 一次完整移動 | `select_gap(選縫隙) → select_block(選一側連通組) → move(方向)`，缺一不可 |
| 縫隙 | `h`=橫縫（行間，只能 `a/d` 左右）；`v`=縱縫（列間，只能 `w/s` 上下）；以 `line` 標號 |
| side 邊界 | above/left 含 `line`（`<=`），below/right 不含（`>`） |
| 滑塊組 | `select_block` 點選縫隙一側與目標塊**連通**的整片方塊（DFS） |
| 方向 | `w`上 / `s`下 / `a`左 / `d`右 |
| step | 每次選中組整體平移 step 的整數倍；體驗版單次移動 = step |
| solved | 所有方塊構成**任意位置**的 `m×n` 或 `n×m` 實心矩形（含轉置，**非回到初始版面**） |
| 單一連通不變量 | 全體方塊任何時刻須整體連通；移動造成斷開/重疊即非法 |
| mod 不變量 | `step > 1` 時 `(r % step, c % step)` 每次合法移動永不變；互動邏輯不依賴它，但 store 須保留假設註釋，防止日後接求解器時破壞 |
| puzzle 標籤 | `"{step}~{m}*{n}"`，例 `2~4*4`；成績/存檔按它分組 |
| map 文本 | `#`=方塊、`_`=空白（`exportMap()/importMap()` 序列化格式） |

## 2. 三連互動 → 網頁版交互映射

| 原版 | 網頁版 |
| --- | --- |
| `select_gap {type: h|v, line}` | 點擊兩區塊之間的分割線（hover 高亮） |
| `select_block {row, col}` | 點擊縫隙一側某個方塊 → DFS 選中整片連通組 |
| `move {w|s|a|d}` | W/S/A/D、方向鍵、拖動畫布方向（觸控） |
| 選中態可視化 | 選中組填充亮綠，選中縫隙正紅高亮 |

## 3. 核心 API 移植對照（與 `game.py` 一一對應）

| 原版 | 網頁版接口（TS） | 注意 |
| --- | --- | --- |
| `SliderMatrix(m, n)` | `new SliderMatrix(m, n)` | 初始 `solved=true` |
| `get_boundaries()` | `getBoundaries()` | 渲染與行/列線判定共用 |
| `is_valid_h_line(line)` / `is_valid_v_line(line)` | 同名 | `min_row <= line < max_row` / `min_col <= line < max_col`（注意：不是 `<= max`） |
| `opt(type, line, block)` | `opt(type, line, r, c): Set<[r,c]>` | 返回選中集合而非改 block 標誌；DFS 連通，不跨線 |
| `try_move(dir, step)` | `tryMove(dir, step): ReadonlyArray<[r,c]> | null` | 逐步 1 格驗證；不合法回 null/[] |
| `commit_move(final)` | `commit(finals)` | 提交後重建矩陣快取 |
| `check_move_valid(sel, nonSel)` | 靜態方法 | 碰撞 + 單一連通 |
| `is_single_connected(positions)` | 靜態方法 | DFS，鄰接四方向 |
| `is_solved()` | `isSolved()` | m×n 或 n×m 實心矩形，無空洞 |
| `shuffle(attempts, step)` | `shuffle(attempts, step)` | 隨機選有效縫隙 + 合法方向 + tryMove |
| `export_map()` / `import_map()` | `exportMap(): string` / `importMap(s): boolean` | `#` / `_` 文本，跨端互通 |
| `GameHistory.save_snapshot()` | `GameHistory.push(snapshot)` | 快照 = blocks 列表 + bounds（語義同原版 matrix+bounds） |
| `GameHistory.restore_snapshot(index)` | `restore(index)` | undo/redo 回到快照 |

## 4. 源碼遷移座標

| 原版 | 網頁版 | 說明 |
| --- | --- | --- |
| `game.py::Block` | `core/Block.ts` | `location=[r,c]`；`be_opted` 改為 store 內獨立 set |
| `game.py::SliderMatrix` | `core/SliderMatrix.ts` | 逐函數移植 |
| `history.py::GameHistory` | `core/GameHistory.ts` | 快照式 undo/redo |
| `gui/events.py::process_commands` | `core/CommandBus.ts` | 舊指令語義做為內部 action 命名 |
| `gui/renderer.py` | `render/BoardRenderer.ts` | Canvas 繪圖、命中測試、動畫 |
| `gui/file_ops.py` | `io/SaveManager.ts` | `save/*.json` → localStorage + 檔案進出 |
| `records.py` / `gui/records_panel.py` | `feature/Records.ts` | 成績面板 |
| `gui/virtual_keyboard.py` | `feature/VirtualKeyboard.ts` | 虛擬鍵盤 |

## 5. 體驗版「刻意不做」清單

| 原版功能 | 體驗版處理 |
| --- | --- |
| HTTP REST / stdin 指令通道 | 不做；改為 `CommandBus` action（命名沿用） |
| 宏定義 | 不做；`stub/macro.ts` 留介面 |
| 求解器 | 不做；日後用 Web Worker / Wasm 掛回 |
| 調試面板 / 洞-凸起標記 | 不做；`stub/metrics.ts` 留語義標註 |
| 連鎖器 | M7 後按需；先提供 `groupOf(r,c)` |
| 高級競速規則（+2/DNF 細節） | 只做 count/best/worst/ao5/ao12/dnf 樸素版 |
