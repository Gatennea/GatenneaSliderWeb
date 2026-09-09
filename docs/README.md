# 貓九的滑塊遊戲 — 網頁體驗版重構

> 本文檔是**索引 + 執行計劃**。開發細節拆到 `docs/` 下，各司其職。

| 檔案 | 職責 | 何時看 |
| --- | --- | --- |
| `README.md`（本檔） | 輕重緩急、架構決策、里程碑、驗收標準 | 規劃與分派 |
| `docs/rules.md` | 規則不變量、三連互動映射、核心 API 移植對照、刻意不做清單 | 寫 `core/*` 時 |
| `docs/theme.md` | 配色/幾何/繪製順序/動畫/文案 token | 寫 `render/*` 時 |
| `docs/progress.md` | 進度勾選、原版問題清單 | 每里程碑收口 |

## 如何開啟（開箱即用）

**最簡單：雙擊 `start.bat`** —— 自動「第一次裝依賴 → 編譯打包 → 用瀏覽器開啟 `game.html`」。

| 方式 | 說明 |
| --- | --- |
| 雙擊 `start.bat` | 建置後直接開 `game.html`（file://，`app.js` 為非 module 單檔） |
| 雙擊 `dev.bat` | 建置後起調試伺服器並開 `http://127.0.0.1:5173`（含 `/api/*`） |
| 手動 `cd web && npm run build` 後雙擊 `game.html` | 與 start.bat 同義 |
| `npm run dev` | 調試伺服器（另帶 REST，供 curl/開發者） |

> 若之前看到黑屏：多半是 `dist/` 沒編譯、或舊版 `game.html` 用了會受 file:// CORS 阻擋的 `<script type="module">`。現在已改成單檔 `app.js`，雙擊 `start.bat` 即可。

### 調試 REST（`npm run dev`）

> 精神參考原版 `http_server.py`，但**不是照搬那套過時指令**——端點與欄位依網頁版現況重寫。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/status` | 完整狀態：puzzle / step_count / solved / matrix(map 文本) / selected_gap / selected_block / bounds / history |
| GET | `/api/map` | `{"ok":true,"map":"##__..."}` |
| POST | `/api/select_gap` | `{"type":"h\|v","line":N}` |
| POST | `/api/select_block` | `{"row":R,"col":C}` |
| POST | `/api/move` | `{"direction":"w\|s\|a\|d"}` |
| POST | `/api/undo` `/api/redo` `/api/shuffle` `/api/reset` `/api/deselect` | —（shuffle 可帶 `attempts`） |
| POST | `/api/new` | `{"m","n","step"}` |

三連範例（curl）：`shuffle` → `select_gap {"type":"h","line":N}` → `select_block {"row","col"}` → `move {"direction":"d"}` → `status`。

## 定位與範圍

- **體驗版**：只做「能玩、能還原、能計時」的完整閉環；求解器、宏、調試面板一律不做（留 stub）。
- **原則**：核心邏輯不重寫，只做 `game.py` / `history.py` 的 1:1 移植；`game.py` 是規則金標準。
- **畫風**：盡量模仿原版，見 `docs/theme.md`。
- **權限**：只寫 `web/`。發現原版疑似 bug 只報告（填 `docs/progress.md`），不直接改。

## 輕重緩急

| 優先級 | 功能 | 體驗版 |
| --- | --- | --- |
| P0 | 選中縫隙、選中滑塊、滑動選中組、撤銷/重做、重置、自動打亂、存檔、導入、切換謎題 | ✅ M1–M4 |
| P1 | 練習模式、計時模式（計時器）、成績面板、虛擬鍵盤 | ✅ M5–M6 |
| P2 | 著色器（連鎖器只留工具函數） | ⚠️ 選做 M7 |
| P3 | 宏定義、求解器、調試面板、連鎖器 | ❌ 不做 |

## 架構決策

| 項目 | 建議 |
| --- | --- |
| 前端 | 純 HTML + TypeScript + Canvas（可選 Vite） |
| 狀態 | 單一 `GameStore`（對應 `SliderGUI` 狀態聚合） |
| 邏輯 | 1:1 移植 `game.py` 的 `opt / try_move / commit_move / is_solved / shuffle` |
| 存儲 | localStorage（存檔/組態/成績）+ 檔案上傳下載（導入/導出） |
| 互通 | 復用原版 `map` 文本（`#`/`_`）與 save JSON 精簡結構 |

## 里程碑

每個里程碑可獨立交付、可玩、可測試。

| 里程碑 | 內容 | 交付準則 |
| --- | --- | --- |
| **M0** 骨架 | 建結構、`index.html` + Canvas 呈現 4×4、`GameStore` 骨架、vitest 入口 | 開啟看到初始版面，`solved===true` |
| **M1** 邏輯+渲染初版 | 逐函數移植 `SliderMatrix`/`GameHistory`；畫方塊、縫隙、選中高亮 | console 能完成一次合法移動，非法被拒 |
| **M2** 三連互動 | 點縫隙/點方塊/鍵盤與拖動移動，命中測試與非法反饋 | 純滑鼠觸屏完成三連並還原 |
| **M3** 撤銷重做重置打亂 | `GameHistory` 快照、Ctrl+Z/Y、`shuffle`、`reset` | 打亂可 undo 到初始，重做不丟 |
| **M4** 存檔導入切換 | localStorage、map 文本導入導出、save JSON、`new{m,n,step}` | 刷新不丟進度，map 與原版互通 |
| **M5** 模式+計時器 | 練習/計時狀態機、raf 停錶 | 打亂→還原得到一次有效成績 |
| **M6** 成績+虛擬鍵盤 | 按 puzzle 分組的 count/best/worst/ao5/ao12/dnf；W/S/A/D+undo+shuffle+reset 按鈕 | 觸屏可完全脫離實體鍵盤 |
| **M7** 著色器（選做） | `(r%step,c%step)` 分組描邊；`groupOf(r,c)` 工具 | step≥2 可見分組色 |
| **M8** 收口 | 對照規則驗收、行為對照表、更新進度 | 全部勾選 |

## 目錄結構

```
web/
├── README.md
├── docs/{rules,theme,progress}.md
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── src/
│   ├── main.ts
│   ├── core/{Block,SliderMatrix,GameHistory,CommandBus,rules}.ts
│   ├── store/GameStore.ts
│   ├── render/{theme,BoardRenderer}.ts
│   ├── io/SaveManager.ts
│   ├── feature/{Timer,Records,VirtualKeyboard}.ts
│   └── stub/{solver,macro,metrics}.ts
└── tests/{SliderMatrix,GameHistory}.test.ts
```

## 驗收標準

1. **規則一致**：單測對照原版 `game.py` 同操作序列，結果一致。
2. **可玩**：不動鍵盤即可三連並還原。
3. **可存儲**：刷新不丟，map 文本與原版互通。
4. **計時閉環**：打亂→還原產生有效成績。
5. **明確邊界**：求解/宏等給「體驗版不含此功能」提示，不靜默報錯。
6. **畫風一致**：色值/線寬/圓角/文案對照 `docs/theme.md` 核對。
