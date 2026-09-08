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
- [ ] M3 撤銷/重做/重置/打亂（核心已移植，UI 待接）
- [ ] M4 存檔/導入/切換謎題（`export_map/import_map` 已移植，UI 待接）
- [ ] M5 練習模式/計時模式/計時器
- [ ] M6 成績面板/虛擬鍵盤
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
