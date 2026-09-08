/* 由 scripts/bundle.mjs 自動生成；來源為已編譯的 dist/。請勿手動編輯。 */
(function () {
  var __modules = { "m0": function (require) {
/**
 * 體驗版入口（M2：三連互動）
 * 深色外框 + 選單/狀態欄，Canvas 棋盤，鍵盤/滑鼠/觸控操作。
 */
const { BoardRenderer } = require("./render/BoardRenderer.js");
const { BoardController } = require("./interaction/BoardController.js");
const { GameStore } = require("./store/GameStore.js");
const { COLORS, GEOMETRY } = require("./render/theme.js");
const { shuffle, reset, undo, redo } = require("./core/CommandBus.js");
const { autosave, autoload, downloadSave, importData } = require("./io/SaveManager.js");
const { Timer, formatTime } = require("./feature/Timer.js");
const { Records, stats, puzzleKey } = require("./feature/Records.js");
const app = document.querySelector('#app');
// 外框（對照原版深色背景 + 選單/狀態欄配色）
app.style.background = COLORS.background;
app.style.height = '100vh';
app.style.overflow = 'hidden';
app.style.display = 'flex';
app.style.flexDirection = 'column';
app.style.fontFamily = 'system-ui, sans-serif';
// 頂部選單欄（對照原版：文件/編輯/謎題/宏定義/設置/幫助）
const menuBar = document.createElement('div');
menuBar.style.height = `${GEOMETRY.menu_bar_height}px`;
menuBar.style.background = COLORS.menu_bg;
menuBar.style.borderBottom = `1px solid ${COLORS.border}`;
menuBar.style.display = 'flex';
menuBar.style.alignItems = 'center';
menuBar.style.paddingLeft = '10px';
menuBar.style.color = COLORS.menu_text;
menuBar.id = 'menuBar';
app.appendChild(menuBar);
const menus = [
    { label: '文件', items: ['打開 Ctrl+O', '保存 Ctrl+S', '另存為...'], handler: (item) => {
            if (item === '保存 Ctrl+S' || item === '另存為...') {
                downloadSave(store);
                showToast(item === '保存 Ctrl+S' ? '已保存' : '已下載存檔');
            }
            else if (item === '打開 Ctrl+O')
                fileInput.click();
        }
    },
    { label: '編輯', items: ['撤銷 Ctrl+Z', '重做 Ctrl+X', '打亂 Alt+S', '重置 Ctrl+R'], handler: (item) => {
            if (item.startsWith('撤銷')) {
                const r = undo(store.cmd);
                showToast(r.message);
                autosave(store);
                schedulePaint();
            }
            else if (item.startsWith('重做')) {
                const r = redo(store.cmd);
                showToast(r.message);
                autosave(store);
                schedulePaint();
            }
            else if (item.startsWith('打亂')) {
                const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
                showToast(r.message);
                renderer.animation = null;
                centerCamera();
                autosave(store);
                timer.reset();
                schedulePaint();
            }
            else if (item.startsWith('重置')) {
                const r = reset(store.cmd);
                showToast(r.message);
                renderer.animation = null;
                centerCamera();
                autosave(store);
                timer.reset();
                schedulePaint();
            }
        }
    },
    { label: '謎題', items: ['2~4*4', '2~5*5', '2~6*6', '2~7*7', '2~8*8', '2~9*9', '2~10*10', '---', '自定義...', '模式:練習', '模式:競速'], handler: (item) => {
            if (item === '自定義...') {
                const m = Number(window.prompt('列數 m（例如 4）', String(store.currentM)));
                const n = Number(window.prompt('行數 n（例如 5）', String(store.currentN)));
                const step = Number(window.prompt('步距 step（需 < max(m,n)）', String(store.currentStep)));
                if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) {
                    showToast('輸入需為整數');
                    return;
                }
                if (step >= Math.max(m, n)) {
                    showToast(`step 需 < max(m,n)=${Math.max(m, n)}`);
                    return;
                }
                store.newPuzzle(m, n, step);
                renderer.animation = null;
                centerCamera();
                autosave(store);
                timer.reset();
                schedulePaint();
                showToast(`切換謎題 ${step}~${m}*${n}`);
            }
            else if (item === '模式:練習') {
                gameMode = 'practice';
                timer.reset();
                showToast('模式：練習');
                schedulePaint();
            }
            else if (item === '模式:競速') {
                gameMode = 'timed';
                timer.reset();
                showToast('模式：競速');
                schedulePaint();
            }
            else if (item !== '---') {
                const parts = item.split('~');
                const step = Number(parts[0]);
                const dims = parts[1].split('*');
                const m = Number(dims[0]), n = Number(dims[1]);
                store.newPuzzle(m, n, step);
                renderer.animation = null;
                centerCamera();
                autosave(store);
                timer.reset();
                schedulePaint();
                showToast(`切換謎題 ${step}~${m}*${n}`);
            }
        }
    },
    { label: '宏定義', items: ['錄製', '執行', '刪除'], handler: () => showToast('體驗版不含宏定義') },
    { label: '設置', items: ['虛擬鍵盤', '成績面板'], handler: (item) => {
            if (item === '虛擬鍵盤') {
                const vis = vkPanel.style.display === 'none';
                vkPanel.style.display = vis ? '' : 'none';
                showToast(vis ? '已開啟虛擬鍵盤' : '已關閉虛擬鍵盤');
            }
            else if (item === '成績面板') {
                const vis = recordsPanel.style.display === 'none';
                recordsPanel.style.display = vis ? '' : 'none';
                if (vis)
                    renderRecordsPanel();
                showToast(vis ? '已開啟成績面板' : '已關閉成績面板');
            }
        }
    },
    { label: '幫助', items: ['關於'], handler: () => showToast('貓九的滑塊遊戲 網頁體驗版 v0.1') },
];
let activeMenu = null;
function buildMenu() {
    menuBar.innerHTML = '';
    menus.forEach((menu, idx) => {
        const btn = document.createElement('div');
        btn.textContent = menu.label;
        btn.style.padding = '0 12px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '13px';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllMenus();
            if (activeMenu?.idx === idx) {
                activeMenu = null;
                return;
            }
            const dropdown = createDropdown(idx, menu);
            activeMenu = { idx, el: dropdown };
            menuBar.appendChild(dropdown);
        });
        menuBar.appendChild(btn);
    });
}
function createDropdown(menuIdx, menuDef) {
    const dd = document.createElement('div');
    dd.style.position = 'absolute';
    dd.style.top = `${GEOMETRY.menu_bar_height}px`;
    dd.style.left = '0';
    dd.style.background = COLORS.menu_bg;
    dd.style.border = `1px solid ${COLORS.dialog_border}`;
    dd.style.minWidth = '180px';
    dd.style.zIndex = '1000';
    dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    menuDef.items.forEach((item) => {
        if (item === '---') {
            const sep = document.createElement('div');
            sep.style.height = '1px';
            sep.style.background = COLORS.separator;
            sep.style.margin = '4px 0';
            dd.appendChild(sep);
            return;
        }
        const row = document.createElement('div');
        row.textContent = item;
        row.style.padding = '6px 12px';
        row.style.cursor = 'pointer';
        row.style.fontSize = '13px';
        row.style.color = item.startsWith('體驗版') ? '#888' : COLORS.menu_text;
        row.addEventListener('mouseenter', () => { row.style.background = COLORS.menu_hover; row.style.color = '#fff'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; row.style.color = item.startsWith('體驗版') ? '#888' : COLORS.menu_text; });
        row.addEventListener('click', () => { closeAllMenus(); menuDef.handler(item); });
        dd.appendChild(row);
    });
    return dd;
}
function closeAllMenus() {
    document.querySelectorAll('#menuBarDropdown').forEach((el) => el.remove());
    activeMenu = null;
}
document.addEventListener('click', closeAllMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape')
    closeAllMenus(); });
buildMenu();
const canvas = document.createElement('canvas');
// 畫布填滿可用區域（體驗版無右側面板，不預留 132px 右欄）
canvas.style.flex = '1 1 auto';
canvas.style.width = '100%';
canvas.style.display = 'block';
canvas.style.touchAction = 'none';
canvas.style.margin = '0';
app.appendChild(canvas);
// 快捷按鈕列（體驗版：打亂 / 重置 / 撤銷 / 重做；完整選單日後做）
const toolbar = document.createElement('div');
toolbar.style.display = 'flex';
toolbar.style.gap = '8px';
toolbar.style.padding = '0 16px 8px';
app.appendChild(toolbar);
const status = document.createElement('div');
status.style.height = `${GEOMETRY.status_bar_height}px`;
status.style.background = COLORS.status_bg;
status.style.borderTop = `1px solid ${COLORS.border}`;
status.style.color = COLORS.status_text;
status.style.display = 'flex';
status.style.alignItems = 'center';
status.style.gap = '30px';
status.style.paddingLeft = '10px';
app.appendChild(status);
// 浮動提示（選中縫隙/選中組/非法移動等，對照 macro_notify_msg）
const toast = document.createElement('div');
toast.style.position = 'fixed';
toast.style.right = '16px';
toast.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
toast.style.color = COLORS.timer_running;
toast.style.fontSize = '13px';
toast.style.pointerEvents = 'none';
app.appendChild(toast);
let toastTimer = 0;
function showToast(text) {
    toast.textContent = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.textContent = ''), 1400);
}
const store = new GameStore(4, 4, 2);
const ctx = canvas.getContext('2d');
const renderer = new BoardRenderer(ctx, 1);
// M6：浮動面板（虛擬鍵盤 / 成績）
const vkPanel = document.createElement('div');
vkPanel.style.position = 'fixed';
vkPanel.style.left = '12px';
vkPanel.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
vkPanel.style.background = COLORS.dialog_bg;
vkPanel.style.border = `1px solid ${COLORS.dialog_border}`;
vkPanel.style.borderRadius = '6px';
vkPanel.style.padding = '10px';
vkPanel.style.display = 'none';
vkPanel.style.zIndex = '500';
app.appendChild(vkPanel);
const recordsPanel = document.createElement('div');
recordsPanel.style.position = 'fixed';
recordsPanel.style.right = '12px';
recordsPanel.style.top = `${GEOMETRY.menu_bar_height + 8}px`;
recordsPanel.style.width = '260px';
recordsPanel.style.maxHeight = '60vh';
recordsPanel.style.overflowY = 'auto';
recordsPanel.style.background = COLORS.dialog_bg;
recordsPanel.style.border = `1px solid ${COLORS.dialog_border}`;
recordsPanel.style.borderRadius = '6px';
recordsPanel.style.padding = '10px';
recordsPanel.style.fontSize = '13px';
recordsPanel.style.color = COLORS.dialog_text;
recordsPanel.style.display = 'none';
recordsPanel.style.zIndex = '500';
app.appendChild(recordsPanel);
// M5：練習/計時模式 + 計時器
let gameMode = 'practice';
const timer = new Timer();
// M6：成績
const records = new Records();
/** 完成或 DNF 時寫入成績（僅競速模式）。 */
function recordResult(dnf) {
    const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
    records.add(store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs), store.cmd.stepCount, dnf);
    if (recordsPanel)
        renderRecordsPanel();
}
// 置中（對照原版 center_map）
function centerCamera() {
    const b = store.game.get_boundaries();
    const left = b.min_col * renderer.step; // 世界
    const right = b.max_col * renderer.step + renderer.cell;
    const top = b.min_row * renderer.step;
    const bottom = b.max_row * renderer.step + renderer.cell;
    const w = (right - left) * renderer.zoom;
    const h = (bottom - top) * renderer.zoom;
    renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
    renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
}
// 依可用區域調整畫布位圖尺寸（保持 CSS == 位圖，座標才 1:1）
function layoutCanvas() {
    const width = Math.max(320, app.clientWidth);
    const height = Math.max(240, app.clientHeight - GEOMETRY.menu_bar_height - GEOMETRY.status_bar_height);
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    centerCamera();
}
layoutCanvas();
window.addEventListener('resize', () => {
    layoutCanvas();
    schedulePaint();
});
// 狀態欄用緩存字串，避免每幀重建 DOM（掉幀主因）
const statusSolved = document.createElement('span');
const statusSteps = document.createElement('span');
const statusPuzzle = document.createElement('span');
const statusTimer = document.createElement('span');
status.append(statusSolved, statusSteps, statusPuzzle, statusTimer);
let lastStatusKey = '';
function updateStatus() {
    const solved = store.solved;
    const timerText = gameMode === 'timed'
        ? `計時：${formatTime(timer.state === 'ready' ? 0 : timer.elapsedMs)}`
        : `模式：練習`;
    const key = `${solved}|${store.cmd.stepCount}|${store.currentStep}~${store.currentM}*${store.currentN}|${timer.state}|${gameMode}`;
    if (key === lastStatusKey)
        return;
    lastStatusKey = key;
    statusSolved.textContent = solved ? '狀態：復原' : '狀態：未復原';
    statusSolved.style.color = solved ? COLORS.solved : COLORS.unsolved;
    statusSteps.textContent = `步數：${store.cmd.stepCount}`;
    statusPuzzle.textContent = `謎題：${store.currentStep}~${store.currentM}*${store.currentN}`;
    statusTimer.textContent = timerText;
    statusTimer.style.color = timer.state === 'running' ? COLORS.timer_running : COLORS.status_text;
}
// on-demand 重繪（dirty flag）：互動/動畫時才重繪，避免無意義滿載 60fps
let needsPaint = true;
let rafQueued = false;
function schedulePaint() {
    needsPaint = true;
    if (rafQueued)
        return;
    rafQueued = true;
    requestAnimationFrame(() => {
        rafQueued = false;
        if (needsPaint) {
            needsPaint = false;
            renderer.draw(store);
            updateStatus();
        }
    });
}
const controller = new BoardController({
    canvas,
    renderer,
    store,
    onStatus: showToast,
    requestPaint: schedulePaint,
    onChanged: () => {
        autosave(store);
        if (gameMode === 'timed') {
            if (timer.state === 'ready')
                timer.start();
            if (store.solved && timer.state === 'running') {
                timer.solve();
                recordResult(false);
            }
        }
        schedulePaint();
    },
});
function addButton(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.background = COLORS.button_bg;
    b.style.color = '#fff';
    b.style.border = 'none';
    b.style.borderRadius = '4px';
    b.style.padding = '6px 12px';
    b.style.cursor = 'pointer';
    b.addEventListener('click', onClick);
    toolbar.appendChild(b);
    return b;
}
addButton('打亂', () => {
    const reply = shuffle(store.cmd, 100);
    showToast(reply.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    schedulePaint();
});
addButton('重置', () => {
    const reply = reset(store.cmd);
    showToast(reply.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    schedulePaint();
});
addButton('撤銷', () => {
    const reply = undo(store.cmd);
    showToast(reply.message);
    autosave(store);
    schedulePaint();
});
addButton('重做', () => {
    const reply = redo(store.cmd);
    showToast(reply.message);
    autosave(store);
    schedulePaint();
});
addButton('存檔', () => {
    downloadSave(store);
    showToast('已下載存檔');
});
addButton('導入', () => {
    fileInput.click();
});
addButton('切換謎題', () => {
    const m = Number(window.prompt('列數 m（例如 4）', String(store.currentM)));
    const n = Number(window.prompt('行數 n（例如 5）', String(store.currentN)));
    const step = Number(window.prompt('步距 step（需 < max(m,n)）', String(store.currentStep)));
    if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) {
        showToast('輸入需為整數');
        return;
    }
    if (step >= Math.max(m, n)) {
        showToast(`step 需 < max(m,n)=${Math.max(m, n)}`);
        return;
    }
    store.newPuzzle(m, n, step);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.reset();
    schedulePaint();
    showToast(`切換謎題 ${step}~${m}*${n}`);
});
addButton('模式', () => {
    gameMode = gameMode === 'practice' ? 'timed' : 'practice';
    timer.reset();
    syncDnfButton();
    showToast(gameMode === 'timed' ? '模式：競速' : '模式：練習');
    schedulePaint();
});
const dnfButton = addButton('DNF', () => {
    if (gameMode === 'timed' && timer.state === 'running') {
        timer.dnf();
        recordResult(true);
        showToast('DNF');
        schedulePaint();
    }
});
dnfButton.style.display = 'none';
function syncDnfButton() {
    dnfButton.style.display = gameMode === 'timed' ? '' : 'none';
}
// M6：虛擬鍵盤（螢幕方向 + 常用動作，行動裝置可用）
const vkRow = document.createElement('div');
vkRow.style.display = 'flex';
vkRow.style.gap = '6px';
vkRow.style.padding = '0 16px 8px';
vkRow.style.flexWrap = 'wrap';
app.insertBefore(vkRow, status);
function vkButton(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.background = COLORS.input_bg;
    b.style.color = '#fff';
    b.style.border = '1px solid ' + COLORS.border;
    b.style.borderRadius = '4px';
    b.style.minWidth = '40px';
    b.style.padding = '8px 14px';
    b.style.cursor = 'pointer';
    b.addEventListener('click', onClick);
    vkRow.appendChild(b);
    return b;
}
vkButton('W', () => controller.move('w'));
vkButton('A', () => controller.move('a'));
vkButton('S', () => controller.move('s'));
vkButton('D', () => controller.move('d'));
vkButton('撤銷', () => { const r = undo(store.cmd); showToast(r.message); autosave(store); schedulePaint(); });
vkButton('打亂', () => { const r = shuffle(store.cmd, 100); showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint(); });
vkButton('重置', () => { const r = reset(store.cmd); showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); schedulePaint(); });
let recordsPanelVisible = false;
const emptyRecordsNote = document.createElement('div');
emptyRecordsNote.style.color = '#888';
emptyRecordsNote.style.marginTop = '6px';
emptyRecordsNote.textContent = '尚無成績記錄';
function renderRecordsPanel() {
    const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
    const list = records.get(key);
    const s = stats(list);
    const best = s.best === null ? '-' : formatTime(s.best);
    const worst = s.worst === null ? '-' : formatTime(s.worst);
    const ao5 = s.ao5 === null ? '-' : (s.ao5 === 'DNF' ? 'DNF' : formatTime(s.ao5));
    const ao12 = s.ao12 === null ? '-' : (s.ao12 === 'DNF' ? 'DNF' : formatTime(s.ao12));
    recordsPanel.innerHTML = '';
    const title = document.createElement('div');
    title.textContent = `成績：${key}`;
    title.style.color = COLORS.dialog_title;
    title.style.marginBottom = '6px';
    recordsPanel.appendChild(title);
    const sum = document.createElement('div');
    sum.textContent = `次數 ${s.count} ｜ 最佳 ${best} ｜ 最差 ${worst} ｜ DNF ${s.dnf_count}`;
    sum.style.marginBottom = '4px';
    recordsPanel.appendChild(sum);
    const ao = document.createElement('div');
    ao.textContent = `Ao5 ${ao5} ｜ Ao12 ${ao12}`;
    ao.style.marginBottom = '8px';
    recordsPanel.appendChild(ao);
    if (list.length === 0) {
        recordsPanel.appendChild(emptyRecordsNote);
        return;
    }
    const table = document.createElement('div');
    list
        .slice()
        .reverse()
        .forEach((r) => {
        const row = document.createElement('div');
        row.style.padding = '2px 0';
        row.style.borderBottom = `1px solid ${COLORS.separator}`;
        const t = r.dnf ? 'DNF' : formatTime(r.time_ms);
        row.textContent = `${t}（${r.moves}步）`;
        if (r.dnf)
            row.style.color = '#cc6666';
        table.appendChild(row);
    });
    recordsPanel.appendChild(table);
}
addButton('成績', () => {
    recordsPanelVisible = !recordsPanelVisible;
    recordsPanel.style.display = recordsPanelVisible ? '' : 'none';
    if (recordsPanelVisible)
        renderRecordsPanel();
});
// 導入檔案 input（隱藏）
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,.txt';
fileInput.style.display = 'none';
app.appendChild(fileInput);
fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f)
        return;
    const reader = new FileReader();
    reader.onload = () => {
        const r = importData(store, String(reader.result ?? ''));
        showToast(r.message);
        if (r.ok) {
            renderer.animation = null;
            centerCamera();
            autosave(store);
            schedulePaint();
        }
    };
    reader.readAsText(f);
    fileInput.value = '';
});
// 啟動時嘗試從 localStorage 恢復
if (autoload(store)) {
    renderer.animation = null;
    centerCamera();
    showToast('已恢復上次進度');
}
// 快捷鍵：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const reply = e.shiftKey ? redo(store.cmd) : undo(store.cmd);
        showToast(reply.message);
        schedulePaint();
    }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        const reply = redo(store.cmd);
        showToast(reply.message);
        schedulePaint();
    }
});
// 計時器顯示即時刷新（僅 running 時，直接更新文字，不全量重繪）
setInterval(() => {
    if (timer.isRunning) {
        statusTimer.textContent = `計時：${formatTime(timer.elapsedMs)}`;
        statusTimer.style.color = COLORS.timer_running;
    }
}, 100);
syncDnfButton();
schedulePaint();
// 簡單 console 自檢（供驗收）
console.log('[web] 初始 solved =', store.solved);
console.log('[web] 互動：點縫隙 → 點方塊 → W/S/A/D 或拖動');

return {};
},
    "m1": function (require) {
/**
 * Canvas 棋盤渲染（M2：命中測試 + 選中縫隙紅線 + camera/zoom + 移動動畫）。
 *
 * 座標模型（對照 GUI.py，唯一真理源）：
 *   - CELL = base_cell_size、GAP = gap_width（未縮放基底）
 *   - 世界座標以「像素」為單位：滑塊(col,row) 左上角 = (col*(CELL+GAP), row*(CELL+GAP))
 *   - 世界 → 螢幕：screen = world * zoom + camera（不重複乘 zoom）
 *   - 縫隙 h line：y = (line+1)*(CELL+GAP) - GAP/2；v 同理
 */
const { COLORS, GEOMETRY, easeOut } = require("./theme.js");
const CELL = GEOMETRY.base_cell_size;
const GAP = GEOMETRY.gap_width;
class BoardRenderer {
    constructor(ctx, zoom = 1) {
        this.animation = null;
        this.ctx = ctx;
        this.zoom = zoom;
        this.cameraX = 0;
        this.cameraY = 0;
    }
    get cell() {
        return CELL;
    }
    get gap() {
        return GAP;
    }
    get step() {
        return CELL + GAP;
    }
    /** 畫布上一個格的實際大小（含 zoom） */
    get scaledCell() {
        return CELL * this.zoom;
    }
    get scaledGap() {
        return GAP * this.zoom;
    }
    /** 供 main 置中用的週期（含縮放） */
    get stepPx() {
        return this.step * this.zoom;
    }
    /** 世界 → 螢幕。對照 GUI.world_to_screen（world*zoom + camera）。 */
    worldToScreen(worldX, worldY) {
        return [worldX * this.zoom + this.cameraX, worldY * this.zoom + this.cameraY];
    }
    /** 螢幕 → 世界。對照 GUI.screen_to_world。 */
    screenToWorld(screenX, screenY) {
        return [(screenX - this.cameraX) / this.zoom, (screenY - this.cameraY) / this.zoom];
    }
    /** 滑塊世界左上角。 */
    blockOrigin(r, c) {
        return [c * this.step, r * this.step];
    }
    /** 根據畫布座標取得滑塊。對照 GUI.get_block_at_pos。 */
    getBlockAtPos(screenX, screenY, store) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        for (const block of store.game.blocks) {
            const [bx, by] = this.blockOrigin(block.row, block.col);
            if (wx >= bx && wx < bx + CELL && wy >= by && wy < by + CELL) {
                return block;
            }
        }
        return null;
    }
    /** 根據畫布座標取得格座標 (r,c)，落在縫隙上回 null。對照 GUI.get_cell_at_pos。 */
    getCellAtPos(screenX, screenY) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        const step = this.step;
        const c = Math.floor(wx / step);
        const r = Math.floor(wy / step);
        if (wx - c * step >= CELL || wy - r * step >= CELL) {
            return null;
        }
        return [r, c];
    }
    /** 根據畫布座標取得縫隙。對照 GUI.get_gap_at_pos。 */
    getGapAtPos(screenX, screenY, store) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        const bounds = store.game.get_boundaries();
        const { min_row, max_row, min_col, max_col } = bounds;
        const gap = GAP;
        const tolerance = gap + 10;
        for (let i = min_row; i <= max_row + 1; i++) {
            const gapY = i * this.step - gap / 2;
            if (Math.abs(wy - gapY) < tolerance) {
                const boardLeft = min_col * this.step;
                const boardRight = (max_col + 1) * this.step;
                if (boardLeft - 50 < wx && wx < boardRight + 50) {
                    const line = i - 1;
                    if (store.game.is_valid_h_line(line))
                        return { type: 'h', line };
                }
            }
        }
        for (let j = min_col; j <= max_col + 1; j++) {
            const gapX = j * this.step - gap / 2;
            if (Math.abs(wx - gapX) < tolerance) {
                const boardTop = min_row * this.step;
                const boardBottom = (max_row + 1) * this.step;
                if (boardTop - 50 < wy && wy < boardBottom + 50) {
                    const line = j - 1;
                    if (store.game.is_valid_v_line(line))
                        return { type: 'v', line };
                }
            }
        }
        return null;
    }
    /** 空白區域 = 不在滑塊也不在縫隙。對照 GUI.is_blank_area。 */
    isBlankArea(screenX, screenY, store) {
        return (this.getBlockAtPos(screenX, screenY, store) === null &&
            this.getGapAtPos(screenX, screenY, store) === null);
    }
    draw(store) {
        const { ctx } = this;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, W, H);
        const bounds = store.game.get_boundaries();
        const selectedGap = store.cmd.selectedGap;
        // 1) 無限網格背景
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let r = bounds.min_row - 1; r <= bounds.max_row + 1; r++) {
            for (let c = bounds.min_col - 1; c <= bounds.max_col + 1; c++) {
                const [x, y] = this.worldToScreen(c * this.step, r * this.step);
                ctx.strokeRect(x, y, this.scaledCell, this.scaledCell);
            }
        }
        // 2) 縫隙線（先畫，讓滑塊蓋在上面；選中紅線、其餘灰線）
        this.drawGapLines(bounds, selectedGap);
        // 3) 滑塊（動畫中則用插值位置）
        for (let idx = 0; idx < store.game.blocks.length; idx++) {
            const block = store.game.blocks[idx];
            let r = block.row;
            let c = block.col;
            if (this.animation) {
                const t = easeOut(this.animation.progress);
                const sr = this.animation.start[idx][0];
                const sc = this.animation.start[idx][1];
                const er = this.animation.end[idx][0];
                const ec = this.animation.end[idx][1];
                r = sr + (er - sr) * t;
                c = sc + (ec - sc) * t;
            }
            const [x, y] = this.worldToScreen(c * this.step, r * this.step);
            const selected = store.game.selected.has(block);
            ctx.fillStyle = selected ? COLORS.block_selected : COLORS.block;
            const radius = GEOMETRY.block_radius * this.zoom;
            this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
            ctx.fill();
            ctx.strokeStyle = COLORS.border;
            ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
            this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
            ctx.stroke();
        }
    }
    drawGapLines(bounds, selectedGap) {
        const { ctx } = this;
        const gap = this.scaledGap;
        const pad = 20; // 對照原版：縫隙向外多畫 20px，但只在棋盤範圍附近，不跨全屏
        // 棋盤實際左右/上下邊界（螢幕座標）
        const left = this.worldToScreen(bounds.min_col * this.step, 0)[0];
        const right = this.worldToScreen(bounds.max_col * this.step + CELL, 0)[0];
        const top = this.worldToScreen(0, bounds.min_row * this.step)[1];
        const bottom = this.worldToScreen(0, bounds.max_row * this.step + CELL)[1];
        // h（橫縫）：只在棋盤左右範圍（外擴 pad）
        for (let i = bounds.min_row; i <= bounds.max_row + 1; i++) {
            const sy = this.worldToScreen(0, i * this.step - GAP / 2)[1];
            const isSelected = !!selectedGap && selectedGap.type === 'h' && selectedGap.line === i - 1;
            ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
            ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
            ctx.beginPath();
            ctx.moveTo(left - pad, sy);
            ctx.lineTo(right + pad, sy);
            ctx.stroke();
        }
        // v（縱縫）：只在棋盤上下範圍（外擴 pad）
        for (let j = bounds.min_col; j <= bounds.max_col + 1; j++) {
            const sx = this.worldToScreen(j * this.step - GAP / 2, 0)[0];
            const isSelected = !!selectedGap && selectedGap.type === 'v' && selectedGap.line === j - 1;
            ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
            ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
            ctx.beginPath();
            ctx.moveTo(sx, top - pad);
            ctx.lineTo(sx, bottom + pad);
            ctx.stroke();
        }
    }
    roundRect(x, y, w, h, r) {
        const { ctx } = this;
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
}

return { BoardRenderer };
},
    "m10": function (require) {
/**
 * 存檔/導入（M4）：localStorage 自動快照 + 檔案下載/上傳 + 解析 map 文本。
 *
 * 體驗版核心狀態用 map 文本（# / _），存檔 JSON 結構：
 *   { version, puzzle:{m,n,step}, step_count, map, history }
 */
const STORAGE_KEY = 'gatennea-slider-web:last';
function puzzleTag(store) {
    return `${store.currentStep}~${store.currentM}*${store.currentN}`;
}
/** localStorage 自動快照（對照原版 temp_history.json）。 */
function autosave(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.serialize()));
        return true;
    }
    catch {
        return false;
    }
}
/** 啟動時恢復 localStorage 快照。回傳是否恢復成功。 */
function autoload(store) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return false;
        const p = JSON.parse(raw);
        return store.deserialize(p);
    }
    catch {
        return false;
    }
}
/** 下載存檔 JSON。 */
function downloadSave(store) {
    const p = store.serialize();
    const name = `${puzzleTag(store)}-save.json`;
    downloadText(name, JSON.stringify(p, null, 2));
}
/** 從 JSON 或 map 文本導入。回傳結果文案。 */
function importData(store, text) {
    const t = text.trim();
    if (!t)
        return { ok: false, message: '內容為空' };
    // 先試 JSON
    if (t[0] === '{') {
        try {
            const p = JSON.parse(t);
            if (store.deserialize(p))
                return { ok: true, message: '已導入存檔' };
            return { ok: false, message: '存檔內容不合法' };
        }
        catch {
            return { ok: false, message: 'JSON 解析失敗' };
        }
    }
    // 否則視為 map 文本（# / _），沿用目前 puzzle 參數
    if (store.game.import_map(t)) {
        return { ok: true, message: '已導入 map' };
    }
    return { ok: false, message: 'map 解析失敗' };
}
function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

return { autosave, autoload, downloadSave, importData };
},
    "m11": function (require) {
/**
 * 計時器（M5）：狀態機 ready → running → solved | dnf。
 * 用 performance.now() 測量，elapsed 毫秒在 rAF 中刷新顯示。
 */
function formatTime(ms) {
    if (ms === null)
        return '-';
    const total = ms / 1000;
    const minutes = Math.floor(total / 60);
    const sec = total - minutes * 60;
    if (minutes > 0)
        return `${minutes}:${sec.toFixed(2).padStart(5, '0')}`;
    return sec.toFixed(2);
}
class Timer {
    constructor() {
        this.state = 'ready';
        this.startMs = 0;
        this.endMs = 0;
    }
    get elapsedMs() {
        if (this.state === 'running')
            return performance.now() - this.startMs;
        return this.endMs - this.startMs;
    }
    /** 進入 ready（打亂後待開始）。 */
    reset() {
        this.state = 'ready';
        this.startMs = 0;
        this.endMs = 0;
    }
    /** 首次合法移動時開始計時。 */
    start() {
        if (this.state !== 'ready')
            return;
        this.state = 'running';
        this.startMs = performance.now();
    }
    /** 完成（solved 自動停錶）。 */
    solve() {
        if (this.state !== 'running')
            return this.elapsedMs;
        this.endMs = performance.now();
        this.state = 'solved';
        return this.elapsedMs;
    }
    /** 手動 DNF。 */
    dnf() {
        this.state = 'dnf';
        this.endMs = performance.now();
    }
    get isRunning() {
        return this.state === 'running';
    }
}

return { formatTime, Timer };
},
    "m12": function (require) {
/**
 * 成績記錄（M6）：按 puzzle 分組存 localStorage，統計 count/best/worst/ao5/ao12/dnf。
 * 對照 records.py 的語義（AoN 取最近 n 次、去掉最好與最差、DNF 視為無窮）。
 */
const STORAGE_KEY = 'gatennea-slider-web:records';
/** 平均（AoN）。不足 n 次回 null；窗口內含 DNF 回 'DNF'；否則平均毫秒。 */
function avgOf(times, n) {
    if (times.length < n)
        return null;
    const window = times.slice(-n);
    const vals = window.map((t) => (t === null ? Infinity : t)).sort((a, b) => a - b);
    const trimmed = vals.slice(1, -1);
    if (trimmed.some((v) => v === Infinity))
        return 'DNF';
    return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}
function stats(records) {
    const times = records.map((r) => (r.dnf ? null : r.time_ms));
    const valid = times.filter((t) => t !== null);
    return {
        count: records.length,
        best: valid.length ? Math.min(...valid) : null,
        worst: valid.length ? Math.max(...valid) : null,
        dnf_count: times.length - valid.length,
        ao5: avgOf(times, 5),
        ao12: avgOf(times, 12),
    };
}
function puzzleKey(m, n, step) {
    return `${step}~${m}*${n}`;
}
class Records {
    constructor() {
        this.data = {};
        this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            this.data = raw ? JSON.parse(raw) : {};
        }
        catch {
            this.data = {};
        }
    }
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
        catch {
            /* ignore */
        }
    }
    add(m, n, step, timeMs, moves, dnf) {
        var _a;
        const item = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            ts: Date.now(),
            m,
            n,
            step,
            time_ms: Math.round(timeMs),
            moves,
            dnf,
        };
        const key = puzzleKey(m, n, step);
        ((_a = this.data)[key] ?? (_a[key] = [])).push(item);
        this.save();
        return item;
    }
    get(key) {
        return this.data[key] ?? [];
    }
    delete(key, id) {
        const list = this.data[key];
        if (!list)
            return false;
        const idx = list.findIndex((r) => r.id === id);
        if (idx < 0)
            return false;
        list.splice(idx, 1);
        if (list.length === 0)
            delete this.data[key];
        this.save();
        return true;
    }
    allKeys() {
        return Object.keys(this.data);
    }
}

return { avgOf, stats, puzzleKey, Records };
},
    "m2": function (require) {
/**
 * 畫風 token（對照 docs/theme.md；來源 GUI.py::self.colors 與 gui/renderer.py）
 * 單一來源，渲染與選單共用，禁止散落寫死色值。
 */
function rgb(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
}
const COLORS = {
    background: rgb(30, 30, 30),
    block: rgb(60, 150, 200),
    block_selected: rgb(0, 200, 100),
    border: rgb(100, 100, 100),
    gap: rgb(80, 80, 80),
    line: rgb(255, 0, 0),
    grid: rgb(40, 40, 40),
    menu_bg: rgb(50, 50, 50),
    menu_hover: rgb(70, 70, 70),
    menu_text: rgb(220, 220, 220),
    menu_selected: rgb(80, 130, 180),
    status_bg: rgb(40, 40, 40),
    status_text: rgb(200, 200, 200),
    dialog_bg: rgb(45, 45, 48),
    dialog_border: rgb(100, 100, 100),
    dialog_text: rgb(230, 230, 230),
    dialog_title: rgb(255, 255, 255),
    solved: rgb(0, 200, 80),
    unsolved: rgb(200, 160, 0),
    input_bg: rgb(60, 60, 65),
    input_active: rgb(80, 80, 120),
    input_text: rgb(255, 255, 255),
    selection_bg: rgb(50, 80, 160),
    button_bg: rgb(70, 130, 180),
    button_hover: rgb(90, 150, 200),
    separator: rgb(80, 80, 80),
    timer_running: rgb(255, 200, 80),
    macro_base_mark: rgb(255, 200, 50),
};
const GEOMETRY = {
    base_cell_size: 60,
    gap_width: 4,
    padding: 10,
    block_radius: 5, // 原版 int(5 * zoom)，zoom=1 時為 5
    block_border_width: 2, // 原版 max(1, int(2 * zoom))
    selected_line_width: 3,
    menu_bar_height: 32,
    status_bar_height: 28,
    right_panel_width: 132,
    min_width: 1000,
    min_height: 618,
};
/** 原版 ease_out：1 - (1-t)^2 */
function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
}
const TEXT = {
    solved: '狀態：復原',
    unsolved: '狀態：未復原',
    stepPrefix: '步數：',
    puzzlePrefix: '謎題：',
    menuItems: ['文件', '編輯', '謎題', '宏', '設置'],
};

return { COLORS, GEOMETRY, easeOut, TEXT };
},
    "m3": function (require) {
/**
 * 棋盤互動控制器（M2）
 * 對照 gui/events.py 的三連互動與 gui/renderer.py 的命中測試。
 *
 * - 點縫隙 → selectGap（再點同縫隙 = 取消）
 * - 點方塊（已選縫隙）→ selectBlock（DFS 選中組）
 * - 鍵盤/方向鍵/拖動 → move（先 try_move 再 commit；非法則閃紅提示）
 * - 空白拖拽 → 平移鏡頭（camera）
 */
const { selectBlock, selectGap } = require("../core/CommandBus.js");
const { isValidDirectionForGap } = require("../core/rules.js");
const MOVE_DURATION_MS = 180;
const DIRECTION_KEYS = {
    w: 'w',
    W: 'w',
    s: 's',
    S: 's',
    a: 'a',
    A: 'a',
    d: 'd',
    D: 'd',
    ArrowUp: 'w',
    ArrowDown: 's',
    ArrowLeft: 'a',
    ArrowRight: 'd',
};
/** 拖動判定為「移動」的最低位移（px） */
const DRAG_MOVE_THRESHOLD = 18;
class BoardController {
    constructor(ui) {
        this.ui = ui;
        this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true };
        this.attach();
    }
    get canvas() {
        return this.ui.canvas;
    }
    notify(message) {
        this.ui.onStatus?.(message);
        this.ui.requestPaint?.();
    }
    flashInvalid() {
        // 簡化的非法移動反饋：短暫把畫布外框閃紅
        const c = this.canvas;
        const prev = c.style.outline;
        c.style.transition = 'outline 0.12s';
        c.style.outline = '3px solid rgba(255, 0, 0, 0.85)';
        setTimeout(() => {
            c.style.outline = prev || 'none';
        }, 200);
    }
    attach() {
        const c = this.canvas;
        c.addEventListener('mousedown', (e) => this.onPointerDown(e.offsetX, e.offsetY));
        c.addEventListener('mousemove', (e) => this.onPointerMove(e.offsetX, e.offsetY));
        window.addEventListener('mouseup', () => this.onPointerUp());
        // 觸控
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            const rect = c.getBoundingClientRect();
            this.onPointerDown(t.clientX - rect.left, t.clientY - rect.top);
        }, { passive: false });
        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            const rect = c.getBoundingClientRect();
            this.onPointerMove(t.clientX - rect.left, t.clientY - rect.top);
        }, { passive: false });
        c.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.onPointerUp();
        }, { passive: false });
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        // 右鍵取消選中（對照原版 event.button == 3）
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.deselect();
            this.notify('已取消選中');
        });
    }
    onPointerDown(x, y) {
        // 按在滑塊上時禁止平移地圖（對照原版）；按在縫隙/空白才能拖動平移
        const onBlock = this.ui.renderer.getBlockAtPos(x, y, this.ui.store) !== null;
        this.drag = {
            active: true,
            startX: x,
            startY: y,
            camX: this.ui.renderer.cameraX,
            camY: this.ui.renderer.cameraY,
            moved: false,
            ax: 0,
            ay: 0,
            pan: !onBlock,
        };
    }
    onPointerMove(x, y) {
        if (!this.drag.active)
            return;
        const dx = x - this.drag.startX;
        const dy = y - this.drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4)
            this.drag.moved = true;
        this.drag.ax = dx;
        this.drag.ay = dy;
        // 拖拽期間即時平移鏡頭（不等到 mouseup）；只有「空白/縫隙按下」才允許平移
        if (this.drag.pan) {
            const r = this.ui.renderer;
            r.cameraX = this.drag.camX + dx;
            r.cameraY = this.drag.camY + dy;
            this.ui.requestPaint?.();
        }
    }
    onPointerUp() {
        if (!this.drag.active)
            return;
        const { store } = this.ui;
        const r = this.ui.renderer;
        const moved = this.drag.moved;
        const dx = this.drag.ax;
        const dy = this.drag.ay;
        const [x, y] = [this.drag.startX, this.drag.startY];
        this.drag.active = false;
        if (!moved) {
            // 視為點擊
            this.handleClick(x, y);
            return;
        }
        // 拖動：若已選中縫隙+滑塊，且位移超過閾值 → 當作移動；否則若「空白按下」才平移鏡頭
        const canDragMove = store.cmd.selectedGap !== null && store.cmd.selectedBlock !== null;
        if (canDragMove && (Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD)) {
            const direction = Math.abs(dx) > Math.abs(dy)
                ? (dx > 0 ? 'd' : 'a')
                : (dy > 0 ? 's' : 'w');
            this.animateMove(direction);
        }
        else if (this.drag.pan) {
            // 平移鏡頭（已在 move 期間跟手，這裡確保最終位置一致）
            r.cameraX = this.drag.camX + dx;
            r.cameraY = this.drag.camY + dy;
            this.ui.requestPaint?.();
        }
    }
    handleClick(x, y) {
        const { store, renderer } = this.ui;
        const gap = renderer.getGapAtPos(x, y, store);
        const block = renderer.getBlockAtPos(x, y, store);
        if (gap !== null) {
            // 再點同一縫隙 = 取消
            const cur = store.cmd.selectedGap;
            if (cur && cur.type === gap.type && cur.line === gap.line) {
                store.cmd.selectedGap = null;
                store.cmd.selectedBlock = null;
                store.game.selected.clear();
                this.notify('已取消縫隙');
            }
            else {
                const reply = selectGap(store.cmd, gap.type, gap.line);
                this.notify(reply.ok ? `選中${gap.type === 'v' ? '縱' : '橫'}向縫隙` : reply.message);
            }
        }
        else if (block !== null && store.cmd.selectedGap !== null) {
            const reply = selectBlock(store.cmd, block.row, block.col);
            this.notify(reply.ok ? `選中滑塊組 共${store.game.selected.size}個` : reply.message);
        }
        else if (renderer.isBlankArea(x, y, store)) {
            this.deselect();
            this.notify('已取消選中');
        }
    }
    onKeyDown(e) {
        if (e.ctrlKey || e.metaKey)
            return; // 保留給 undo/redo 快捷鍵（M3）
        const dir = DIRECTION_KEYS[e.key];
        if (!dir)
            return;
        e.preventDefault();
        this.animateMove(dir);
    }
    /** 對外：虛擬鍵盤/程式化移動入口。 */
    move(direction) {
        this.animateMove(direction);
    }
    /** 帶動畫的移動：預測 → 動畫插值 → 提交。 */
    animateMove(direction) {
        const { store, renderer } = this.ui;
        const cmd = store.cmd;
        if (!cmd.selectedGap) {
            this.notify('請先選中縫隙');
            return;
        }
        if (!cmd.selectedBlock) {
            this.notify('請先選中滑塊');
            return;
        }
        if (!isValidDirectionForGap(cmd.selectedGap.type, direction)) {
            this.flashInvalid();
            this.notify(`移動方向非法（${cmd.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s'}）`);
            return;
        }
        const finalPositions = store.game.try_move(direction, store.currentStep);
        if (!finalPositions) {
            this.flashInvalid();
            this.notify('移動不合法（碰撞或斷連）');
            return;
        }
        // 建立全量 block 的起點/終點（選中組終點用 finalPositions，其餘原地）
        const selectedList = store.game.blocks.filter((b) => store.game.selected.has(b));
        const endBySelected = new Map(selectedList.map((b, i) => [b, finalPositions[i]]));
        const start = store.game.blocks.map((b) => [b.row, b.col]);
        const end = store.game.blocks.map((b) => {
            const e = endBySelected.get(b);
            return e ? [e[0], e[1]] : [b.row, b.col];
        });
        renderer.animation = { start, end, progress: 0, durationMs: MOVE_DURATION_MS };
        const t0 = performance.now();
        const frame = (now) => {
            const anim = renderer.animation;
            if (!anim)
                return;
            const p = Math.min(1, (now - t0) / anim.durationMs);
            anim.progress = p;
            this.ui.requestPaint?.();
            if (p < 1) {
                requestAnimationFrame(frame);
            }
            else {
                renderer.animation = null;
                // 提交（對照 CommandBus.move 的 commit 尾巴；先 commit 再存快照）
                store.game.commit_move(finalPositions);
                store.game.selected.clear();
                cmd.selectedGap = null;
                cmd.selectedBlock = null;
                cmd.stepCount += 1;
                cmd.history.save_snapshot(store.game);
                this.notify(`移動 ${direction}`);
                this.ui.onChanged?.();
                this.ui.requestPaint?.();
            }
        };
        requestAnimationFrame(frame);
    }
    deselect() {
        const { store } = this.ui;
        store.cmd.selectedGap = null;
        store.cmd.selectedBlock = null;
        store.game.selected.clear();
        this.ui.requestPaint?.();
    }
}

return { BoardController };
},
    "m4": function (require) {
/**
 * 內部指令匯流排（對照 gui/events.py::process_commands 的動作語義）
 *
 * 體驗版不做 HTTP/stdin 通道；用同一套 action 名稱封裝，方便日後
 * 把求解器掛到 Web Worker 時沿用原版指令協定。
 */
const { GameHistory } = require("./GameHistory.js");
const { SliderMatrix } = require("./SliderMatrix.js");
const { isValidDirectionForGap } = require("./rules.js");
function createContext(game, step) {
    const ctx = {
        game,
        history: new GameHistory(),
        selectedGap: null,
        selectedBlock: null,
        step,
        stepCount: 0,
        shuffleBefore: null,
    };
    // 存初始快照作為 undo 基準（第一個 move 才能撤回到初始版面）
    ctx.history.save_snapshot(game);
    return ctx;
}
function selectGap(ctx, type, line) {
    const valid = type === 'h' ? ctx.game.is_valid_h_line(line) : ctx.game.is_valid_v_line(line);
    if (!valid) {
        return { ok: false, message: `${type} 分割線 ${line} 不合法` };
    }
    ctx.selectedGap = { type, line };
    ctx.game.selected.clear();
    ctx.selectedBlock = null;
    return { ok: true, message: `已選中縫隙: ${type} ${line}` };
}
function selectBlock(ctx, row, col) {
    if (!ctx.selectedGap) {
        return { ok: false, message: '請先選中縫隙' };
    }
    const block = ctx.game.blocks.find((b) => b.row === row && b.col === col);
    if (!block) {
        return { ok: false, message: `位置 (${row}, ${col}) 沒有滑塊` };
    }
    ctx.game.opt(ctx.selectedGap.type, ctx.selectedGap.line, block);
    ctx.selectedBlock = [row, col];
    const n = ctx.game.selected.size;
    return { ok: true, message: `選中滑塊組 共${n}個` };
}
function move(ctx, direction) {
    if (!ctx.selectedGap) {
        return { ok: false, message: '請先選中縫隙' };
    }
    if (!ctx.selectedBlock) {
        return { ok: false, message: '請先選中滑塊' };
    }
    if (!isValidDirectionForGap(ctx.selectedGap.type, direction)) {
        const g = ctx.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s';
        return { ok: false, message: `移動方向非法（${g}）` };
    }
    const finalPositions = ctx.game.try_move(direction, ctx.step);
    if (!finalPositions) {
        return { ok: false, message: '移動不合法（碰撞或斷連）' };
    }
    ctx.game.commit_move(finalPositions);
    ctx.game.selected.clear();
    ctx.selectedGap = null;
    ctx.selectedBlock = null;
    ctx.stepCount += 1;
    ctx.history.save_snapshot(ctx.game);
    return { ok: true, message: `移動 ${direction}` };
}
function undo(ctx) {
    if (!ctx.history.canUndo) {
        return { ok: false, message: '沒有可撤銷的步驟' };
    }
    ctx.history.undo(ctx.game);
    ctx.stepCount = Math.max(0, ctx.stepCount - 1);
    return { ok: true, message: '撤銷' };
}
function redo(ctx) {
    if (!ctx.history.canRedo) {
        return { ok: false, message: '沒有可重做的步驟' };
    }
    ctx.history.redo(ctx.game);
    ctx.stepCount += 1;
    return { ok: true, message: '重做' };
}
function shuffle(ctx, attempts = 100) {
    ctx.shuffleBefore = ctx.game.snapshot();
    ctx.game.shuffle(attempts, ctx.step);
    ctx.selectedGap = null;
    ctx.selectedBlock = null;
    ctx.stepCount = 0;
    ctx.history = new GameHistory();
    // 打亂後存快照，作為 undo 的基準（退回打亂後第一個狀態）
    ctx.history.save_snapshot(ctx.game);
    return { ok: true, message: '已打亂' };
}
/** reset = 回到復原狀態並清空歷史（對照原版 reset_puzzle → new_puzzle(current m/n/step)）。 */
function reset(ctx) {
    const m = ctx.game.m;
    const n = ctx.game.n;
    ctx.game = new SliderMatrix(m, n);
    ctx.selectedGap = null;
    ctx.selectedBlock = null;
    ctx.stepCount = 0;
    ctx.history = new GameHistory();
    ctx.history.save_snapshot(ctx.game);
    ctx.shuffleBefore = null;
    return { ok: true, message: '已重置' };
}

return { createContext, selectGap, selectBlock, move, undo, redo, shuffle, reset };
},
    "m5": function (require) {
/**
 * 快照式撤銷/重做（對照 history.py::GameHistory）
 *
 * 原版快照存 matrix + bounds；網頁版直接存 blocks 位置列表，
 * 語義一致、更適合純邏輯層。
 */
const { Block } = require("./Block.js");
class GameHistory {
    constructor() {
        this.entries = [];
        this.index = -1;
    }
    /** 保存當前狀態快照；若不在歷史末尾則截斷。 */
    save_snapshot(game) {
        const snapshot = {
            blocks: game.blocks.map((b) => [b.row, b.col]),
        };
        if (this.index < this.entries.length - 1) {
            this.entries = this.entries.slice(0, this.index + 1);
        }
        this.entries.push(snapshot);
        this.index = this.entries.length - 1;
    }
    get canUndo() {
        return this.index > 0;
    }
    get canRedo() {
        return this.index >= 0 && this.index < this.entries.length - 1;
    }
    get length() {
        return this.entries.length;
    }
    get currentIndex() {
        return this.index;
    }
    /** 撤銷：回退一步，並把快照套用到 game。 */
    undo(game) {
        if (!this.canUndo)
            return false;
        this.index -= 1;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 重做：前進一步。 */
    redo(game) {
        if (!this.canRedo)
            return false;
        this.index += 1;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 匯出全部快照（供存檔）。 */
    snapshotAll() {
        return this.entries.map((e) => ({ blocks: e.blocks.map(([r, c]) => [r, c]) }));
    }
    /** 由快照列表還原（index 設為末位，對應載入時停在最新狀態）。 */
    restoreAll(list) {
        this.entries = list.map((e) => ({ blocks: e.blocks.map(([r, c]) => [r, c]) }));
        this.index = this.entries.length - 1;
    }
    apply(game, entry) {
        game.blocks = entry.blocks.map(([r, c]) => new Block([r, c]));
        game.selected.clear();
    }
}

return { GameHistory };
},
    "m6": function (require) {
/**
 * 滑塊 Block（對照 game.py::Block）
 *
 * 原版把 be_opted 存在每個 block 上；網頁版把選中狀態移出，
 * 由 SliderMatrix.selected 集合統一管理，避免物件上散布可變標誌。
 */
class Block {
    constructor(location) {
        this.location = location;
    }
    get row() {
        return this.location[0];
    }
    get col() {
        return this.location[1];
    }
    clone() {
        return new Block([this.location[0], this.location[1]]);
    }
}

return { Block };
},
    "m7": function (require) {
/**
 * 滑塊矩陣核心邏輯（對照 game.py::SliderMatrix 逐函數移植）
 *
 * 移植紀律：分支結構與原版保持一致；只把選中旗標 be_opted
 * 從 Block 物件移到 `selected` 集合，語義不變。
 */
const { Block } = require("./Block.js");
const { DIRECTION_DELTA } = require("./rules.js");
class SliderMatrix {
    constructor(m = 6, n = 6) {
        this.m = m;
        this.n = n;
        this.blocks = [];
        this.selected = new Set();
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                this.blocks.push(new Block([i, j]));
            }
        }
    }
    get_boundaries() {
        if (this.blocks.length === 0) {
            return { min_row: 0, max_row: 0, min_col: 0, max_col: 0 };
        }
        const rows = this.blocks.map((b) => b.row);
        const cols = this.blocks.map((b) => b.col);
        return {
            min_row: Math.min(...rows),
            max_row: Math.max(...rows),
            min_col: Math.min(...cols),
            max_col: Math.max(...cols),
        };
    }
    is_valid_h_line(line) {
        const bounds = this.get_boundaries();
        return bounds.min_row <= line && line < bounds.max_row;
    }
    is_valid_v_line(line) {
        const bounds = this.get_boundaries();
        return bounds.min_col <= line && line < bounds.max_col;
    }
    /**
     * 檢查移動後是否合法（碰撞 + 全體單一連通）。
     * 對照 game.py::check_move_valid。
     */
    static check_move_valid(selectedPositions, nonSelectedPositions) {
        if (selectedPositions.size + nonSelectedPositions.size === 0)
            return true;
        for (const pos of selectedPositions) {
            if (nonSelectedPositions.has(pos))
                return false; // collision
        }
        const all = new Set([...selectedPositions, ...nonSelectedPositions]);
        return SliderMatrix.is_single_connected(all);
    }
    static is_single_connected(positions) {
        if (positions.size === 0)
            return true;
        const start = positions.values().next().value;
        const visited = new Set();
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current))
                continue;
            visited.add(current);
            const [r, c] = current.split(':').map(Number);
            for (const [dr, dc] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbor = `${r + dr}:${c + dc}`;
                if (positions.has(neighbor) && !visited.has(neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        return visited.size === positions.size;
    }
    /**
     * 選中分割線一側、與選中滑塊連通的整片方塊。
     * 對照 game.py::opt（DFS）。
     * @returns 選中的位置集合（原版直接標 be_opted）
     */
    opt(gapType, line, selectedBlock) {
        // 清除舊選中（原版會先清所有 be_opted）
        this.selected.clear();
        const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        const isConnected = (a, b) => {
            // 判斷兩個相鄰方塊是否在同一側（不被分割線隔開）
            if (gapType === 'h') {
                if ((a[0] <= line && b[0] > line) || (a[0] > line && b[0] <= line)) {
                    return false;
                }
            }
            else {
                if ((a[1] <= line && b[1] > line) || (a[1] > line && b[1] <= line)) {
                    return false;
                }
            }
            return true;
        };
        const start = selectedBlock.location;
        const visited = new Set();
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            const key = `${current[0]}:${current[1]}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            const [row, col] = current;
            for (const [dr, dc] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbor = [row + dr, col + dc];
                const nKey = `${row + dr}:${col + dc}`;
                if (blockSet.has(nKey) && !visited.has(nKey) && isConnected(current, neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        // 依原版：把 visited 對應的方塊標為選中
        for (const b of this.blocks) {
            if (visited.has(`${b.row}:${b.col}`)) {
                this.selected.add(b);
            }
        }
        return visited;
    }
    /**
     * 預測移動（純邏輯，逐步 1 格驗證）。
     * 對照 game.py::try_move；不合法回傳 null。
     */
    try_move(direction, step) {
        const selected = this.blocks.filter((b) => this.selected.has(b));
        const nonSelectedPositions = new Set(this.blocks.filter((b) => !this.selected.has(b)).map((b) => `${b.row}:${b.col}`));
        if (selected.length === 0)
            return null;
        const delta = DIRECTION_DELTA[direction];
        if (!delta)
            return null;
        let current = selected.map((b) => [b.row, b.col]);
        for (let k = 0; k < step; k++) {
            const next = current.map(([r, c]) => [r + delta[0], c + delta[1]]);
            const nextSet = new Set(next.map(([r, c]) => `${r}:${c}`));
            if (!SliderMatrix.check_move_valid(nextSet, nonSelectedPositions)) {
                return null;
            }
            current = next;
        }
        return current.map(([r, c]) => [r, c]);
    }
    /** 提交移動（對照 game.py::commit_move）。 */
    commit_move(finalPositions) {
        const selected = this.blocks.filter((b) => this.selected.has(b));
        for (let i = 0; i < selected.length; i++) {
            selected[i].location = [finalPositions[i][0], finalPositions[i][1]];
        }
    }
    is_solved() {
        if (this.blocks.length === 0)
            return false;
        const rows = this.blocks.map((b) => b.row);
        const cols = this.blocks.map((b) => b.col);
        const minR = Math.min(...rows);
        const maxR = Math.max(...rows);
        const minC = Math.min(...cols);
        const maxC = Math.max(...cols);
        const height = maxR - minR + 1;
        const width = maxC - minC + 1;
        if (!((height === this.m && width === this.n) || (height === this.n && width === this.m))) {
            return false;
        }
        const posSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (!posSet.has(`${r}:${c}`))
                    return false;
            }
        }
        return true;
    }
    /**
     * 隨機打亂（對照 game.py::shuffle）。
     * 注意：刻意保留原版候選縫隙範圍 `range(min+1, max)` —— 不選邊界縫隙是「規定」，
     * 使網頁版行為與原版逐位元一致。
     */
    shuffle(attempts, step, rng = Math.random) {
        for (let i = 0; i < attempts; i++) {
            const bounds = this.get_boundaries();
            const { min_row, max_row, min_col, max_col } = bounds;
            const hLines = [];
            for (let line = min_row + 1; line < max_row; line++) {
                if (this.is_valid_h_line(line))
                    hLines.push(line);
            }
            const vLines = [];
            for (let line = min_col + 1; line < max_col; line++) {
                if (this.is_valid_v_line(line))
                    vLines.push(line);
            }
            const allGaps = [
                ...hLines.map((line) => ({ type: 'h', line })),
                ...vLines.map((line) => ({ type: 'v', line })),
            ];
            if (allGaps.length === 0)
                continue;
            const gap = allGaps[Math.floor(rng() * allGaps.length)];
            const direction = gap.type === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';
            const block = this.blocks[Math.floor(rng() * this.blocks.length)];
            this.opt(gap.type, gap.line, block);
            const finalPositions = this.try_move(direction, step);
            if (!finalPositions) {
                this.selected.clear();
                continue;
            }
            this.commit_move(finalPositions);
            this.selected.clear();
        }
        this.selected.clear();
    }
    /** 導出 map 文本（#=方塊、_=空白）。對照 game.py::export_map。 */
    export_map() {
        const { min_row, max_row, min_col, max_col } = this.get_boundaries();
        const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        const rows = [];
        for (let row = min_row; row <= max_row; row++) {
            let line = '';
            for (let col = min_col; col <= max_col; col++) {
                line += blockSet.has(`${row}:${col}`) ? '#' : '_';
            }
            rows.push(line);
        }
        return rows.join('\n');
    }
    /** 導入 map 文本。對照 game.py::import_map。 */
    import_map(mapStr) {
        const lines = mapStr
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (lines.length === 0)
            return false;
        this.blocks = [];
        this.selected.clear();
        this.m = lines.length;
        this.n = lines[0]?.length ?? 0;
        for (let row = 0; row < lines.length; row++) {
            const line = lines[row];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === '#') {
                    this.blocks.push(new Block([row, col]));
                }
            }
        }
        return true;
    }
    /** 快照當前版面（供 GameHistory 使用）。 */
    snapshot() {
        return { blocks: this.blocks.map((b) => [b.row, b.col]) };
    }
    /** 由快照還原版面。 */
    restore(snapshot) {
        this.blocks = snapshot.blocks.map(([r, c]) => new Block([r, c]));
        this.selected.clear();
    }
}

return { SliderMatrix };
},
    "m8": function (require) {
/**
 * 規則常量（對照 game.py / 術語規定.md）
 *
 * - h 縫隙（橫向，row 之間）只能 a/d（左右）
 * - v 縫隙（縱向，col 之間）只能 w/s（上下）
 * - side 邊界：above/left 含 line（<=），below/right 不含（>）
 */
const DIRECTION_DELTA = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
};
/** h 縫隙的合法移動方向 */
const VALID_DIRECTIONS_FOR_GAP = {
    h: ['a', 'd'],
    v: ['w', 's'],
};
function isValidDirectionForGap(gap, dir) {
    return VALID_DIRECTIONS_FOR_GAP[gap].includes(dir);
}
/**
 * mod 不變量：step > 1 時，每次合法移動使每塊的 (r % step, c % step) 永不變。
 * 互動邏輯不依賴它，但務必保留此假設（日後接求解器/著色/連鎖時共用）。
 */
function modGroupOf(r, c, step) {
    return ((r % step) * step + (c % step)) >>> 0;
}

return { DIRECTION_DELTA, VALID_DIRECTIONS_FOR_GAP, isValidDirectionForGap, modGroupOf };
},
    "m9": function (require) {
/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * M1 先放核心狀態；計時/面板等後續里程碑再加。
 */
const { createContext } = require("../core/CommandBus.js");
const { SliderMatrix } = require("../core/SliderMatrix.js");
class GameStore {
    constructor(m = 4, n = 4, step = 2) {
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.game = new SliderMatrix(m, n);
        this.cmd = createContext(this.game, step);
    }
    get solved() {
        return this.game.is_solved();
    }
    get selectedGap() {
        return this.cmd.selectedGap;
    }
    get selectedCells() {
        return new Set([...this.cmd.game.selected].map((b) => `${b.row}:${b.col}`));
    }
    /** 便捷方法：轉換謎題（對照 new {m,n,step}）。 */
    newPuzzle(m, n, step) {
        if (step >= Math.max(m, n))
            return false;
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.game = new SliderMatrix(m, n);
        this.cmd = createContext(this.game, step);
        return true;
    }
    /** 序列化為可存檔的 JSON 結構（體驗版用 map 文本當核心，不照搬原版 matrix/bounds）。 */
    serialize() {
        return {
            version: 1,
            puzzle: { m: this.currentM, n: this.currentN, step: this.currentStep },
            step_count: this.cmd.stepCount,
            map: this.game.export_map(),
            history: this.cmd.history.snapshotAll(),
        };
    }
    /** 由序列化結構還原。 */
    deserialize(p) {
        const m = p.puzzle?.m ?? this.currentM;
        const n = p.puzzle?.n ?? this.currentN;
        const step = p.puzzle?.step ?? this.currentStep;
        if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step))
            return false;
        if (step >= Math.max(m, n))
            return false;
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.game = new SliderMatrix(m, n);
        if (typeof p.map === 'string' && p.map.trim().length > 0) {
            this.game.import_map(p.map);
        }
        this.cmd = createContext(this.game, step);
        this.cmd.stepCount = p.step_count ?? 0;
        if (Array.isArray(p.history)) {
            this.cmd.history.restoreAll(p.history);
        }
        return true;
    }
}

return { GameStore };
} };
  var __cache = {};
  function __load(id) {
    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];
    var fn = __modules[id];
    if (!fn) throw new Error('module not found: ' + id);
    var require = function (spec) { return __load(__resolvedId(id, spec)); };
    return __cache[id] = fn(require);
  }
  var __resolve = { "E:/program_project/py/貓九的滑塊遊戲/web/dist/main.js": "m0",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/render/BoardRenderer.js": "m1",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/io/SaveManager.js": "m10",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/feature/Timer.js": "m11",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/feature/Records.js": "m12",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/render/theme.js": "m2",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/interaction/BoardController.js": "m3",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/CommandBus.js": "m4",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/GameHistory.js": "m5",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/Block.js": "m6",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/SliderMatrix.js": "m7",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/rules.js": "m8",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/store/GameStore.js": "m9" };
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
  __load("m0");
})();
