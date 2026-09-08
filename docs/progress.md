# 進度追蹤與原版問題清單

> 每個里程碑完成後勾選；發現原版疑似 bug 時填入「原版問題清單」，不直接改原版程式。

## 1. 進度追蹤

- [x] M0 工程骨架（零構建工具：tsc + 原生 ES modules + 自寫測試執行器）
- [x] M1 純邏輯核心移植 + 渲染初版（`core/*`、`render/theme`、`BoardRenderer`、初始 4×4 呈現）
- [x] M2 三連互動（選縫隙/選組/滑動）
  - 點縫隙 → selectGap（再點同縫隙取消）；點方塊（已選縫隙）→ DFS 選中組；W/S/A/D＋方向鍵＋拖動 → move；非法移動閃紅；右鍵/空白取消；空白拖拽平移鏡頭。
  - 移動動畫（ease-out 插值，`BoardRenderer.animation` + `requestAnimationFrame`）。
  - 選中效果：選中縫隙畫紅色半透明帶 + 紅線；選中組綠色填充（新增 2 個渲染效果測試鎖定）。
  - 修正：
    - 縫隙錯位（camera 未套用到縫隙 + zoom 重複縮放）。
    - 掉幀（on-demand 重繪 + 狀態欄緩存）。
    - **canvas 被 flex 容器壓縮 → CSS 尺寸 ≠ 位圖尺寸**，導致選中點不中、拖動地圖比滑鼠快（已 `flex:0 0 auto` + 明訂 CSS 寬高）。
    - `start.bat`/`dev.bat` 中文在 cmd 被 GBK 錯解 → 全改 ASCII 輸出。
  - 前置：調試 HTTP 服務 `scripts/dev-server.mjs`（`npm run dev`，靜態 + `/api/*` REST）。
  - 入口：`start.bat`（雙擊建置並開 index.html）、`dev.bat`（雙擊建置並開調試伺服器）。
- [x] M3 撤銷/重做/重置/打亂
  - 工具列四鍵（打亂/重置/撤銷/重做）+ 快捷鍵 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y。
  - 語義：shuffle 存打亂前快照 → reset 回打亂前；undo/redo 走快照（含步數增減與無歷史邊界提示）。
  - 修正：歷史快照在 commit「之後」記錄（redo 才回得準）；createContext/shuffle/reset 各存一張基準快照作為 undo 起點。
  - 新增 CommandBus 整合測試（shuffle/reset、move/undo/redo、方向限制、邊界提示）。

## M3 後續視覺/交互修正

- 畫布改為**填滿可用區域**（體驗版無右側面板，不再預留 132px 右欄，消除右邊一大塊空白）。
- 拖動地圖判定：**按在滑塊上不觸發平移**（對照原版），僅空白/縫隙處才拖動平移。
- 選中縫隙紅線：移除跨棋盤的紅色半透明帶，紅線為**線段**（只在棋盤範圍，貼合縫隙）。
- [x] M4 存檔/導入/切換謎題
  - 存檔：localStorage 自動快照（每次移動/打亂/重置後）+ 手動下載 JSON（puzzle/step_count/map/history）。
  - 導入：上傳 JSON 存檔或 map 文本（# / _）。
  - 切換謎題：按鈕輸入 m/n/step（校驗 step < max(m,n)）。
  - 新增 `src/io/SaveManager.ts`、`GameStore.serialize/deserialize`、`GameHistory.snapshotAll/restoreAll`。
  - 新增存檔/導入/切換測試（往返、校驗、map 導入）。
- [x] M5 練習模式/計時模式/計時器
  - 練習模式（預設）與競速模式切換按鈕；競速才有 DNF 按鈕與計時顯示。
  - 計時狀態機 ready→running→solved|dnf（`src/feature/Timer.ts`）；首次合法移動起跑、還原自動停錶、狀態欄即時刷新時間。
  - 計時顯示格式對照 records.format_time（厘秒 / 分:秒）。
- [x] M6 成績面板/虛擬鍵盤
  - 成績：`src/feature/Records.ts` 按 puzzle 分組存 localStorage；競速完成/DNF 自動入榜；成績面板顯示 count/best/worst/dnf/ao5/ao12 與逐筆列表（AoN 對照 records.py）。
  - 虛擬鍵盤：螢幕 W/A/S/D + 撤銷/打亂/重置按鈕（行動裝置可用；方向經 `BoardController.move`）。
- [ ] M7 著色器（可選）
- [ ] M8 驗收與文檔收口

> M1 驗收：`npm test` 全過（10/10）；`npm run build` 產出單檔 `app.js`，雙擊 `index.html`（file://）即可看到初始版面。
> 環境備註：受限環境禁止 Node spawn 子進程（esbuild/vitest/`node --test` 均 EPERM），因此改為零 spawn 方案：`tsc` 以 in-process 模式編譯（`node node_modules/typescript/lib/tsc.js`），測試用自寫 in-process runner，打包用自寫 in-process `scripts/bundle.mjs`（產出非 module 的 `app.js`，規避 file:// 的 CORS 限制）。

## 2. 原版問題清單（遷移中發現、僅報告）

> 格式：位置、現象、影響、建議。

| 編號 | 位置 | 現象 | 影響 | 建議 |
| --- | --- | --- | --- | --- |
| （暫無） | — | — | — | — |

> 已澄清、非問題（不列入）：
> - `game.py::SliderMatrix.shuffle` 刻意不選邊界縫隙（`line == min_row` / `min_col`）——**依用戶確認是規定**，網頁版懷照保留此行為（見 `src/core/SliderMatrix.ts` 註釋）。
> - 先前我把 `import_map` 的 `strip()`/空行過濾當成疑點，經澄清屬正常容錯處理，不列為 bug。
