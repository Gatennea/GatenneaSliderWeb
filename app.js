/* 由 scripts/bundle.mjs 自動生成；來源為已編譯的 dist/。請勿手動編輯。 */
(function () {
  var __modules = { "m0": function (require) {
/**
 * 體驗版入口
 * 對照原版 GUI：頂部下拉選單 + 中央棋盤 + 右側面板(滑條/開關) + 底部狀態列。
 */
const { BoardRenderer } = require("./render/BoardRenderer.js");
const { BoardController } = require("./interaction/BoardController.js");
const { GameStore } = require("./store/GameStore.js");
const { COLORS, GEOMETRY } = require("./render/theme.js");
const { shuffle, reset, undo, redo } = require("./core/CommandBus.js");
const { autosave, autoload, downloadSave, saveAs, importData } = require("./io/SaveManager.js");
const { Timer, formatTime } = require("./feature/Timer.js");
const { Records, stats, puzzleKey } = require("./feature/Records.js");
const app = document.querySelector('#app');
app.style.background = COLORS.background;
app.style.height = '100vh';
app.style.overflow = 'hidden';
app.style.display = 'flex';
app.style.flexDirection = 'column';
app.style.fontFamily = 'system-ui, sans-serif';
// ---------- 頂部選單欄 ----------
const menuBar = document.createElement('div');
menuBar.style.height = `${GEOMETRY.menu_bar_height}px`;
menuBar.style.background = COLORS.menu_bg;
menuBar.style.borderBottom = `1px solid ${COLORS.border}`;
menuBar.style.display = 'flex';
menuBar.style.alignItems = 'center';
menuBar.style.paddingLeft = '10px';
menuBar.style.color = COLORS.menu_text;
menuBar.style.userSelect = 'none';
menuBar.id = 'menuBar';
app.appendChild(menuBar);
// ---------- 中央區域（棋盤 + 右側面板） ----------
const content = document.createElement('div');
content.style.display = 'flex';
content.style.flex = '1 1 auto';
content.style.minHeight = '0';
app.appendChild(content);
const canvas = document.createElement('canvas');
canvas.style.flex = '1 1 auto';
canvas.style.display = 'block';
canvas.style.width = 'auto';
canvas.style.height = '100%';
canvas.style.minWidth = '0';
content.appendChild(canvas);
const rightPanel = document.createElement('div');
rightPanel.style.width = '132px';
rightPanel.style.flex = '0 0 132px';
rightPanel.style.background = COLORS.menu_bg;
rightPanel.style.borderLeft = `1px solid ${COLORS.border}`;
rightPanel.style.padding = '10px 8px';
rightPanel.style.display = 'flex';
rightPanel.style.flexDirection = 'column';
rightPanel.style.gap = '6px';
rightPanel.style.boxSizing = 'border-box';
content.appendChild(rightPanel);
// ---------- 底部狀態列 ----------
const status = document.createElement('div');
status.style.height = `${GEOMETRY.status_bar_height}px`;
status.style.background = COLORS.status_bg;
status.style.borderTop = `1px solid ${COLORS.border}`;
status.style.color = COLORS.status_text;
status.style.display = 'flex';
status.style.alignItems = 'center';
status.style.gap = '24px';
status.style.paddingLeft = '10px';
status.style.fontSize = '13px';
app.appendChild(status);
// 狀態列欄位（對照原版左→中→右）
const stSolved = document.createElement('span');
const stSteps = document.createElement('span');
const stTimer = document.createElement('span');
const stPuzzle = document.createElement('span');
const stZoom = document.createElement('span');
status.append(stSolved, stSteps, stTimer, stPuzzle, stZoom);
// ---------- 浮動面板 ----------
// ---------- 浮動面板（可拖動） ----------
const vkPanel = document.createElement('div');
vkPanel.style.position = 'fixed';
vkPanel.style.left = '12px';
vkPanel.style.top = '40px';
vkPanel.style.background = COLORS.dialog_bg;
vkPanel.style.border = `1px solid ${COLORS.dialog_border}`;
vkPanel.style.borderRadius = '6px';
vkPanel.style.zIndex = '500';
vkPanel.style.display = 'none';
vkPanel.style.padding = '0';
vkPanel.style.overflow = 'hidden';
app.appendChild(vkPanel);
const vkHeader = document.createElement('div');
vkHeader.style.display = 'flex';
vkHeader.style.alignItems = 'center';
vkHeader.style.justifyContent = 'space-between';
vkHeader.style.background = '#3c3c48';
vkHeader.style.padding = '4px 8px';
vkHeader.style.cursor = 'move';
vkHeader.style.userSelect = 'none';
const vkTitle = document.createElement('span');
vkTitle.textContent = '虚拟键盘';
vkTitle.style.color = '#fff';
vkTitle.style.fontSize = '13px';
const vkClose = document.createElement('span');
vkClose.textContent = '×';
vkClose.style.color = '#fff';
vkClose.style.cursor = 'pointer';
vkClose.style.padding = '0 4px';
vkHeader.append(vkTitle, vkClose);
vkPanel.appendChild(vkHeader);
const vkBody = document.createElement('div');
vkBody.style.padding = '8px';
vkBody.style.background = 'rgba(40,40,48,0.94)';
vkPanel.appendChild(vkBody);
vkClose.addEventListener('click', () => { vkPanel.style.display = 'none'; });
const recordsPanel = document.createElement('div');
recordsPanel.style.position = 'fixed';
recordsPanel.style.right = '12px';
recordsPanel.style.top = '40px';
recordsPanel.style.width = '260px';
recordsPanel.style.maxHeight = '60vh';
recordsPanel.style.background = COLORS.dialog_bg;
recordsPanel.style.border = `1px solid ${COLORS.dialog_border}`;
recordsPanel.style.borderRadius = '6px';
recordsPanel.style.zIndex = '500';
recordsPanel.style.display = 'none';
recordsPanel.style.padding = '0';
recordsPanel.style.overflow = 'hidden';
app.appendChild(recordsPanel);
const recordsHeader = document.createElement('div');
recordsHeader.style.display = 'flex';
recordsHeader.style.alignItems = 'center';
recordsHeader.style.justifyContent = 'space-between';
recordsHeader.style.background = '#3c3c48';
recordsHeader.style.padding = '4px 8px';
recordsHeader.style.cursor = 'move';
recordsHeader.style.userSelect = 'none';
const recordsTitle = document.createElement('span');
recordsTitle.textContent = '成绩';
recordsTitle.style.color = '#fff';
recordsTitle.style.fontSize = '13px';
const recordsClose = document.createElement('span');
recordsClose.textContent = '×';
recordsClose.style.color = '#fff';
recordsClose.style.cursor = 'pointer';
recordsClose.style.padding = '0 4px';
recordsHeader.append(recordsTitle, recordsClose);
recordsPanel.appendChild(recordsHeader);
const recordsBody = document.createElement('div');
recordsBody.style.padding = '10px';
recordsBody.style.maxHeight = 'calc(60vh - 28px)';
recordsBody.style.overflowY = 'auto';
recordsPanel.appendChild(recordsBody);
recordsClose.addEventListener('click', () => { recordsPanel.style.display = 'none'; });
function makeDraggable(panel, header) {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    header.addEventListener('mousedown', (e) => {
        if (e.target === header.querySelector('span:last-child'))
            return;
        dragging = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging)
            return;
        panel.style.left = `${e.clientX - ox}px`;
        panel.style.top = `${e.clientY - oy}px`;
        panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
}
makeDraggable(vkPanel, vkHeader);
makeDraggable(recordsPanel, recordsHeader);
// ---------- Toast ----------
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
// ---------- 遊戲狀態 ----------
const store = new GameStore(4, 4, 2);
const renderer = new BoardRenderer(canvas.getContext('2d'), 1);
let gameMode = 'practice';
const timer = new Timer();
const records = new Records();
function centerCamera() {
    const b = store.game.get_boundaries();
    const left = b.min_col * renderer.step;
    const right = b.max_col * renderer.step + renderer.cell;
    const top = b.min_row * renderer.step;
    const bottom = b.max_row * renderer.step + renderer.cell;
    const w = (right - left) * renderer.zoom;
    const h = (bottom - top) * renderer.zoom;
    renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
    renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
}
function layoutCanvas() {
    const w = Math.max(320, canvas.clientWidth);
    const h = Math.max(240, canvas.clientHeight);
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    centerCamera();
}
function updateStatus() {
    stSolved.textContent = store.solved ? '状态：复原' : '状态：未复原';
    stSolved.style.color = store.solved ? COLORS.solved : COLORS.unsolved;
    stSteps.textContent = `步数：${store.cmd.stepCount}`;
    stPuzzle.textContent = `谜题：${store.currentStep}~${store.currentM}*${store.currentN}`;
    stZoom.textContent = `缩放：${Math.round(renderer.zoom * 100)}%`;
    const timerText = gameMode === 'timed'
        ? `计时：${formatTime(timer.state === 'ready' ? 0 : timer.elapsedMs)}`
        : `模式：练习`;
    stTimer.textContent = timerText;
    stTimer.style.color = timer.state === 'running' ? COLORS.timer_running : COLORS.status_text;
}
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
                const ms = timer.elapsedMs;
                records.add(store.currentM, store.currentN, store.currentStep, Math.round(ms), store.cmd.stepCount, false);
                showToast(`完成 ${formatTime(ms)}`);
            }
        }
        schedulePaint();
    },
});
// 鼠標滾輪縮放：向上滾放大、向下滾縮小
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wx, wy] = renderer.screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    renderer.zoom = Math.max(0.5, Math.min(4, renderer.zoom * factor));
    // 以鼠標位置為中心：縮放後讓同一世界點仍留在鼠標下
    renderer.cameraX = sx - wx * renderer.zoom;
    renderer.cameraY = sy - wy * renderer.zoom;
    schedulePaint();
}, { passive: false });
;
// 供成績面板與 DNF
function recordDnf() {
    if (gameMode !== 'timed' || timer.state !== 'running')
        return;
    timer.dnf();
    records.add(store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs), store.cmd.stepCount, true);
    showToast('DNF');
    schedulePaint();
}
// 右側開關狀態
let selectionAnimationEnabled = true;
const switchStates = [
    { key: 'animation_enabled', label: '滑动动画', get: () => controller.animationEnabled, set: (v) => { controller.animationEnabled = v; } },
    { key: 'selection_animation_enabled', label: '选中动画', get: () => selectionAnimationEnabled, set: (v) => { selectionAnimationEnabled = v; } },
    { key: 'coloring_enabled', label: '着色', get: () => false, set: () => { } },
    { key: 'chain_hint_enabled', label: '连锁', get: () => false, set: () => { } },
    { key: 'game_mode', label: '模式', get: () => gameMode === 'timed', set: (v) => { gameMode = v ? 'timed' : 'practice'; timer.reset(); showToast(v ? '模式：竞速' : '模式：练习'); schedulePaint(); } },
    { key: 'macro_reverse_mode', label: '逆序宏', get: () => false, set: () => { } },
];
function renderSwitch(s) {
    if (!s.el)
        return;
    const on = s.get();
    s.el.style.background = on ? COLORS.button_bg : COLORS.input_bg;
    s.el.style.color = on ? '#fff' : '#969696';
    const text = s.key === 'game_mode' ? `模式:${on ? '竞速' : '练习'}` : `${s.label}:${on ? '开' : '关'}`;
    s.el.textContent = text;
}
switchStates.forEach((s) => {
    const el = document.createElement('div');
    el.style.height = '24px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.cursor = 'pointer';
    el.style.fontSize = '12px';
    el.style.borderRadius = '4px';
    s.el = el;
    renderSwitch(s);
    el.addEventListener('click', () => { s.set(!s.get()); renderSwitch(s); });
    rightPanel.appendChild(el);
});
// ---------- 右側面板垂直滑條：縮放 / 速度 ----------
// 原版：缩放條在左、速度條在右，兩條並排於面板上方
const sliderArea = document.createElement('div');
sliderArea.style.flex = '1 1 auto';
sliderArea.style.minHeight = '0';
sliderArea.style.display = 'flex';
sliderArea.style.flexDirection = 'row';
sliderArea.style.order = '-1';
sliderArea.style.gap = '8px';
rightPanel.appendChild(sliderArea);
function makeSlider(label, onChange) {
    const wrap = document.createElement('div');
    wrap.style.flex = '1 1 auto';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    const lab = document.createElement('div');
    lab.style.color = COLORS.status_text;
    lab.style.fontSize = '12px';
    lab.textContent = label;
    const track = document.createElement('div');
    track.style.flex = '1 1 auto';
    track.style.width = '6px';
    track.style.background = COLORS.border;
    track.style.borderRadius = '3px';
    track.style.position = 'relative';
    track.style.cursor = 'pointer';
    const knob = document.createElement('div');
    knob.style.position = 'absolute';
    knob.style.left = '-5px';
    knob.style.width = '16px';
    knob.style.height = '12px';
    knob.style.background = COLORS.button_bg;
    knob.style.borderRadius = '3px';
    track.appendChild(knob);
    wrap.append(lab, track);
    sliderArea.appendChild(wrap);
    function updateFromY(clientY) {
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        onChange(ratio);
        knob.style.top = `${(1 - ratio) * rect.height - 6}px`;
    }
    track.addEventListener('mousedown', (e) => {
        updateFromY(e.clientY);
        const onMove = (ev) => updateFromY(ev.clientY);
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
    return { track, knob };
}
const zoomSlider = makeSlider('缩放', (ratio) => {
    renderer.zoom = Math.max(0.5, Math.min(4, 0.5 + ratio * 3.5));
    centerCamera();
    schedulePaint();
});
const speedSlider = makeSlider('速度', (ratio) => {
    controller.moveDurationMs = Math.max(60, Math.min(800, 800 - ratio * 740));
    schedulePaint();
});
// ---------- 虛擬鍵盤浮動面板 ----------
let stickyOn = false;
function buildVK() {
    vkBody.innerHTML = '';
    const btn = (t, cb) => {
        const b = document.createElement('button');
        b.textContent = t;
        b.style.background = COLORS.button_bg;
        b.style.color = '#fff';
        b.style.border = 'none';
        b.style.borderRadius = '4px';
        b.style.padding = '5px 0';
        b.style.cursor = 'pointer';
        b.style.fontSize = '13px';
        b.style.fontFamily = 'inherit';
        b.style.fontWeight = 'normal';
        b.addEventListener('click', cb);
        return b;
    };
    // 方向鍵區（原版十字排列）
    const pad = document.createElement('div');
    pad.style.display = 'grid';
    pad.style.gridTemplateColumns = 'repeat(3, 44px)';
    pad.style.gap = '4px';
    const padEmpty = document.createElement('span');
    padEmpty.textContent = '';
    pad.appendChild(padEmpty);
    pad.appendChild(btn('↑', () => controller.move('w')));
    pad.appendChild(padEmpty.cloneNode(false));
    pad.appendChild(btn('←', () => controller.move('a')));
    pad.appendChild(btn('↓', () => controller.move('s')));
    pad.appendChild(btn('→', () => controller.move('d')));
    // 動作列（粘滞 / 撤銷 / 重做）
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '4px';
    actionRow.style.marginTop = '6px';
    const stickyBtn = btn('粘滞:单步', () => {
        stickyOn = !stickyOn;
        stickyBtn.textContent = stickyOn ? '粘滞:连续' : '粘滞:单步';
        showToast(stickyOn ? '粘滞：连续' : '粘滞：单步');
    });
    const undoBtn = btn('撤销', () => {
        if (stickyOn) {
            const iv = window.setInterval(() => {
                if (!store.cmd.history.canUndo) {
                    window.clearInterval(iv);
                    return;
                }
                handleUndo();
            }, 200);
        }
        else
            handleUndo();
    });
    const redoBtn = btn('重做', () => {
        if (stickyOn) {
            const iv = window.setInterval(() => {
                if (!store.cmd.history.canRedo) {
                    window.clearInterval(iv);
                    return;
                }
                handleRedo();
            }, 200);
        }
        else
            handleRedo();
    });
    actionRow.append(stickyBtn, undoBtn, redoBtn);
    // 跳到某步（輸入步數 + 跳到）
    const jumpRow = document.createElement('div');
    jumpRow.style.display = 'flex';
    jumpRow.style.gap = '4px';
    jumpRow.style.marginTop = '6px';
    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = '0';
    jumpInput.value = String(store.cmd.stepCount);
    jumpInput.style.width = '52px';
    jumpInput.style.background = COLORS.input_bg;
    jumpInput.style.color = COLORS.input_text;
    jumpInput.style.border = '1px solid ' + COLORS.border;
    jumpInput.style.borderRadius = '4px';
    jumpInput.style.padding = '4px';
    const jumpBtn = btn('跳到', () => {
        const idx = Number(jumpInput.value);
        if (!Number.isInteger(idx)) {
            showToast('請輸入步數');
            return;
        }
        if (store.cmd.history.jumpTo(store.game, idx)) {
            store.cmd.stepCount = idx;
            autosave(store);
            schedulePaint();
            showToast('已跳到第 ' + idx + ' 步');
        }
        else
            showToast('步數超出範圍');
    });
    jumpRow.append(jumpInput, jumpBtn);
    vkBody.append(pad, actionRow, jumpRow);
}
function toggleVK() {
    const vis = vkPanel.style.display === 'none';
    vkPanel.style.display = vis ? '' : 'none';
    if (vis)
        buildVK();
    showToast(vis ? '已開啟虛擬鍵盤' : '已關閉虛擬鍵盤');
}
// ---------- 成績面板 ----------
function renderRecordsPanel() {
    const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
    const list = records.get(key);
    const s = stats(list);
    recordsBody.innerHTML = '';
    const t = document.createElement('div');
    t.textContent = `成績：${key}`;
    t.style.marginBottom = '6px';
    t.style.color = COLORS.dialog_title;
    recordsBody.appendChild(t);
    const sum = document.createElement('div');
    const fmt = (v) => v === null ? '-' : v === 'DNF' ? 'DNF' : formatTime(v);
    sum.textContent = `次數 ${s.count} ｜ 最佳 ${fmt(s.best)} ｜ 最差 ${fmt(s.worst)} ｜ DNF ${s.dnf_count} ｜ Ao5 ${fmt(s.ao5)} ｜ Ao12 ${fmt(s.ao12)}`;
    recordsBody.appendChild(sum);
    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = '#888';
        empty.style.marginTop = '6px';
        empty.textContent = '尚無成績記錄';
        recordsBody.appendChild(empty);
        return;
    }
    list.slice().reverse().forEach((r) => {
        const row = document.createElement('div');
        row.style.padding = '2px 0';
        row.style.borderBottom = `1px solid ${COLORS.separator}`;
        row.textContent = `${r.dnf ? 'DNF' : formatTime(r.time_ms)}（${r.moves}步）`;
        if (r.dnf)
            row.style.color = '#cc6666';
        recordsBody.appendChild(row);
    });
}
function toggleRecords() {
    const vis = recordsPanel.style.display === 'none';
    recordsPanel.style.display = vis ? '' : 'none';
    if (vis)
        renderRecordsPanel();
    showToast(vis ? '已開啟成績面板' : '已關閉成績面板');
}
// ---------- 共用動作 ----------
const DIR_DELTA_ANIM = { w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };
/** 依 move_info 建立只動「該步滑塊組」的完整過場陣列；找不到對應塊回 null */
function buildHistoryAnim(moveInfo, isUndo) {
    const game = store.game;
    const delta = DIR_DELTA_ANIM[moveInfo.direction];
    if (!delta)
        return null;
    const step = moveInfo.step || store.currentStep;
    const start = game.blocks.map((b) => [b.row, b.col]);
    const end = start.map((p) => [p[0], p[1]]);
    const posToIdx = new Map();
    game.blocks.forEach((b, i) => posToIdx.set(`${b.row}:${b.col}`, i));
    for (const pre of moveInfo.moved_positions) {
        const post = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
        const idx = isUndo
            ? posToIdx.get(`${post[0]}:${post[1]}`)
            : posToIdx.get(`${pre[0]}:${pre[1]}`);
        if (idx === undefined)
            return null;
        end[idx] = isUndo ? [pre[0], pre[1]] : [post[0], post[1]];
    }
    return { start, end };
}
function blocksAtPositions(positions) {
    const map = new Map();
    store.game.blocks.forEach((b) => map.set(`${b.row}:${b.col}`, b));
    const set = new Set();
    for (const pos of positions) {
        const b = map.get(`${pos[0]}:${pos[1]}`);
        if (b)
            set.add(b);
    }
    return set;
}
function flashMoveSelection(moveInfo, isUndo, afterCommit) {
    if (!selectionAnimationEnabled || !moveInfo)
        return;
    const delta = DIR_DELTA_ANIM[moveInfo.direction];
    if (!delta)
        return;
    const step = moveInfo.step || store.currentStep;
    const targets = [];
    for (const pre of moveInfo.moved_positions) {
        const post = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
        const pos = afterCommit ? (isUndo ? pre : post) : (isUndo ? post : pre);
        targets.push(pos);
    }
    const sel = blocksAtPositions(targets);
    if (sel.size === 0)
        return;
    store.game.selected = sel;
    // 選中動畫也要顯示該步選中的縫隙（紅線），對照原版 _flash_move_selection
    if (moveInfo.gap_type !== undefined && moveInfo.gap_line !== undefined) {
        store.cmd.selectedGap = { type: moveInfo.gap_type, line: moveInfo.gap_line };
    }
    window.setTimeout(() => {
        store.game.selected.clear();
        store.cmd.selectedGap = null;
        schedulePaint();
    }, 420);
}
// 撤銷/重做動畫佇列（對照原版 _animation_queue + _process_next_in_queue）
const historyAnimQueue = [];
let historyAnimBusy = false;
function requestHistoryStep(kind) {
    const hist = store.cmd.history;
    if (kind === 'undo' && !hist.canUndo) {
        showToast('沒有可撤銷的步驟');
        return;
    }
    if (kind === 'redo' && !hist.canRedo) {
        showToast('沒有可重做的步驟');
        return;
    }
    historyAnimQueue.push(kind);
    processHistoryQueue();
}
function processHistoryQueue() {
    if (historyAnimBusy || historyAnimQueue.length === 0)
        return;
    historyAnimBusy = true;
    const kind = historyAnimQueue.shift();
    runHistoryAnimation(kind, () => {
        historyAnimBusy = false;
        processHistoryQueue();
    });
}
function runHistoryAnimation(kind, onDone) {
    const hist = store.cmd.history;
    const moveInfo = kind === 'undo' ? hist.currentMoveInfo() : hist.nextMoveInfo();
    const commit = () => {
        const r = kind === 'undo' ? undo(store.cmd) : redo(store.cmd);
        if (!r.ok) {
            showToast(r.message);
            onDone();
            return;
        }
        flashMoveSelection(moveInfo, kind === 'undo', true);
        autosave(store);
        schedulePaint();
        showToast(r.message);
        onDone();
    };
    if (!controller.animationEnabled) {
        commit();
        return;
    }
    let anim = moveInfo ? buildHistoryAnim(moveInfo, kind === 'undo') : null;
    if (!anim) {
        const target = kind === 'undo' ? hist.undoTarget() : hist.redoTarget();
        if (target) {
            const start = store.game.blocks.map((b) => [b.row, b.col]);
            anim = { start, end: target.blocks };
        }
    }
    if (!anim) {
        commit();
        return;
    }
    // 播放前：把該步滑塊組設為「選中」，動畫期間跟著移動（看起來像實時操作）
    if (moveInfo) {
        const delta = DIR_DELTA_ANIM[moveInfo.direction];
        const step = moveInfo.step || store.currentStep;
        const startPositions = kind === 'undo'
            ? moveInfo.moved_positions.map((pre) => [pre[0] + delta[0] * step, pre[1] + delta[1] * step])
            : moveInfo.moved_positions;
        store.game.selected = blocksAtPositions(startPositions);
        if (moveInfo.gap_type !== undefined && moveInfo.gap_line !== undefined) {
            store.cmd.selectedGap = { type: moveInfo.gap_type, line: moveInfo.gap_line };
        }
    }
    renderer.animation = { start: anim.start, end: anim.end, progress: 0, durationMs: controller.moveDurationMs };
    const t0 = performance.now();
    const frame = (now) => {
        const a = renderer.animation;
        if (!a)
            return;
        const p = Math.min(1, (now - t0) / a.durationMs);
        a.progress = p;
        schedulePaint();
        if (p < 1) {
            requestAnimationFrame(frame);
        }
        else {
            renderer.animation = null;
            commit();
        }
    };
    requestAnimationFrame(frame);
}
function handleUndo() {
    requestHistoryStep('undo');
}
function handleRedo() {
    requestHistoryStep('redo');
}
function handleShuffle() {
    const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
    showToast(r.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.reset();
    schedulePaint();
}
function handleReset() {
    const r = reset(store.cmd);
    showToast(r.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.reset();
    schedulePaint();
}
function handleCustomPuzzle() {
    // 用自訂頁面表單取代瀏覽器內建 prompt
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.55)';
    overlay.style.zIndex = '2000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.addEventListener('click', () => overlay.remove());
    const box = document.createElement('div');
    box.style.background = COLORS.dialog_bg;
    box.style.border = `1px solid ${COLORS.dialog_border}`;
    box.style.borderRadius = '8px';
    box.style.padding = '18px';
    box.style.width = '260px';
    box.style.color = COLORS.dialog_text;
    box.style.fontSize = '13px';
    box.addEventListener('click', (e) => e.stopPropagation());
    const title = document.createElement('div');
    title.textContent = '自訂謎題';
    title.style.marginBottom = '12px';
    title.style.fontWeight = 'bold';
    box.appendChild(title);
    const fields = [
        ['列數 m', String(store.currentM)],
        ['行數 n', String(store.currentN)],
        ['步距 step', String(store.currentStep)],
    ];
    const inputs = [];
    fields.forEach(([label, value]) => {
        const lab = document.createElement('label');
        lab.style.display = 'block';
        lab.style.marginBottom = '8px';
        const span = document.createElement('span');
        span.textContent = label;
        span.style.display = 'block';
        const input = document.createElement('input');
        input.value = value;
        input.type = 'number';
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.background = COLORS.input_bg;
        input.style.color = COLORS.input_text;
        input.style.border = `1px solid ${COLORS.dialog_border}`;
        input.style.borderRadius = '4px';
        input.style.padding = '6px';
        inputs.push(input);
        lab.append(span, input);
        box.appendChild(lab);
    });
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.marginTop = '12px';
    const ok = document.createElement('button');
    ok.textContent = '確定';
    ok.style.background = COLORS.button_bg;
    ok.style.color = '#fff';
    ok.style.border = 'none';
    ok.style.borderRadius = '4px';
    ok.style.padding = '6px 14px';
    ok.style.cursor = 'pointer';
    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.style.background = COLORS.input_bg;
    cancel.style.color = '#fff';
    cancel.style.border = `1px solid ${COLORS.border}`;
    cancel.style.borderRadius = '4px';
    cancel.style.padding = '6px 14px';
    cancel.style.cursor = 'pointer';
    cancel.addEventListener('click', () => overlay.remove());
    ok.addEventListener('click', () => {
        const m = Number(inputs[0].value);
        const n = Number(inputs[1].value);
        const step = Number(inputs[2].value);
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
        overlay.remove();
    });
    btnRow.append(cancel, ok);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    app.appendChild(overlay);
}
function handlePresetPuzzle(label) {
    const m = Number(label.split('*')[0].split('~')[1]);
    const n = Number(label.split('*')[1]);
    const step = Number(label.split('~')[0]);
    store.newPuzzle(m, n, step);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.reset();
    schedulePaint();
    showToast(`切換謎題 ${step}~${m}*${n}`);
}
function setGameMode(mode) {
    gameMode = mode;
    timer.reset();
    showToast(mode === 'timed' ? '模式：竞速' : '模式：练习');
    schedulePaint();
}
const menus = [
    { label: '文件', items: ['打开 Ctrl+O', '保存 Ctrl+S', '另存为...'], handler: (item) => {
            if (item.includes('另存')) {
                saveAs(store);
                showToast('另存為...');
            }
            else if (item.includes('保存')) {
                downloadSave(store);
                showToast('已下載存檔');
            }
            else if (item.includes('打开'))
                fileInput.click();
        }
    },
    { label: '编辑', items: ['撤销 Ctrl+Z', '重做 Ctrl+X', '打乱 Alt+S', '重置 Ctrl+R'], handler: (item) => {
            if (item.startsWith('撤销'))
                handleUndo();
            else if (item.startsWith('重做'))
                handleRedo();
            else if (item.startsWith('打乱'))
                handleShuffle();
            else if (item.startsWith('重置'))
                handleReset();
        }
    },
    { label: '谜题', items: ['2~4*4', '2~5*5', '2~6*6', '2~7*7', '2~8*8', '2~9*9', '2~10*10', '---', '3~6*6', '3~7*7', '3~8*8', '3~9*9', '3~10*10', '---', '自定义...', '模式:练习', '模式:竞速'], handler: (item) => {
            if (item === '自定义...')
                handleCustomPuzzle();
            else if (item === '模式:练习')
                setGameMode('practice');
            else if (item === '模式:竞速')
                setGameMode('timed');
            else if (item !== '---')
                handlePresetPuzzle(item);
        }
    },
    { label: '宏定义', items: ['录制', '执行', '删除'], handler: () => showToast('體驗版不含宏定義') },
    { label: '设置', items: ['虚拟键盘', '成绩面板'], handler: (item) => {
            if (item.includes('虚拟键盘'))
                toggleVK();
            else if (item.includes('成绩'))
                toggleRecords();
        }
    },
    { label: '帮助', items: ['关于'], handler: () => showToast('貓九的滑塊遊戲 網頁體驗版 v0.1') },
];
let activeMenu = null;
function closeAllMenus() {
    menuBar.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
    activeMenu = null;
}
function buildMenu() {
    menuBar.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
    menuBar.querySelectorAll('[data-menu-item]').forEach((el) => el.remove());
    menus.forEach((menu, idx) => {
        const item = document.createElement('div');
        item.dataset['menuItem'] = '1';
        item.textContent = menu.label;
        item.style.padding = '0 14px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '13px';
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeMenu === idx) {
                closeAllMenus();
                return;
            }
            closeAllMenus();
            const dd = document.createElement('div');
            dd.dataset['dropdown'] = '1';
            dd.style.position = 'absolute';
            dd.style.top = `${GEOMETRY.menu_bar_height}px`;
            dd.style.left = `${idx * 60 + 4}px`;
            dd.style.background = COLORS.menu_bg;
            dd.style.border = `1px solid ${COLORS.dialog_border}`;
            dd.style.minWidth = '170px';
            dd.style.zIndex = '1000';
            dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            menu.items.forEach((mi) => {
                if (mi === '---') {
                    const sep = document.createElement('div');
                    sep.style.height = '1px';
                    sep.style.background = COLORS.separator;
                    sep.style.margin = '4px 0';
                    dd.appendChild(sep);
                    return;
                }
                const row = document.createElement('div');
                row.textContent = mi;
                row.style.padding = '6px 12px';
                row.style.cursor = 'pointer';
                row.style.fontSize = '13px';
                row.addEventListener('mouseenter', () => { row.style.background = COLORS.menu_hover; });
                row.addEventListener('mouseleave', () => { row.style.background = ''; });
                row.addEventListener('click', () => { closeAllMenus(); menu.handler(mi); });
                dd.appendChild(row);
            });
            menuBar.appendChild(dd);
            activeMenu = idx;
        });
        menuBar.appendChild(item);
    });
}
// ---------- 檔案導入 ----------
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,.txt,.map';
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
// ---------- 快捷鍵 ----------
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
        closeAllMenus();
        return;
    }
    if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey)
            handleRedo();
        else
            handleUndo();
        return;
    }
    if (ctrl && key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
    }
    if (ctrl && key === 'x') {
        e.preventDefault();
        handleRedo();
        return;
    }
    if (ctrl && key === 's') {
        e.preventDefault();
        downloadSave(store);
        showToast('已下載存檔');
        return;
    }
    if (ctrl && key === 'o') {
        e.preventDefault();
        fileInput.click();
        return;
    }
    if (ctrl && key === 'r') {
        e.preventDefault();
        handleReset();
        return;
    }
    if (e.altKey && key === 's') {
        e.preventDefault();
        handleShuffle();
        return;
    }
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (gameMode === 'timed') {
            if (timer.state === 'ready') {
                timer.start();
                showToast('計時開始');
                schedulePaint();
            }
            else if (timer.state === 'running') {
                recordDnf();
            }
        }
        return;
    }
    if (e.key === 'F1') {
        e.preventDefault();
        toggleVK();
        return;
    }
    if (e.key === 'F3') {
        e.preventDefault();
        toggleRecords();
        return;
    }
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBar'))
        closeAllMenus();
});
// ---------- 初始化 ----------
buildMenu();
buildVK();
layoutCanvas();
window.addEventListener('resize', () => { layoutCanvas(); schedulePaint(); });
if (autoload(store)) {
    centerCamera();
    showToast('已恢復上次進度');
}
schedulePaint();
setInterval(() => {
    if (timer.isRunning) {
        stTimer.textContent = `计时：${formatTime(timer.elapsedMs)}`;
        stTimer.style.color = COLORS.timer_running;
    }
}, 100);
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
        /** 選中動畫：短暫高亮的格子集合（undo/redo 時顯示移動過的組） */
        this.highlightCells = null;
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
            const hl = this.highlightCells !== null && this.highlightCells.has(`${Math.round(r)}:${Math.round(c)}`);
            ctx.fillStyle = selected || hl ? COLORS.block_selected : COLORS.block;
            const radius = GEOMETRY.block_radius * this.zoom;
            this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
            ctx.fill();
            ctx.strokeStyle = COLORS.border;
            ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
            this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
            ctx.stroke();
            if (this.highlightCells && this.highlightCells.has(`${Math.round(r)}:${Math.round(c)}`)) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.lineWidth = 2;
                this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
                ctx.stroke();
            }
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
 * 存檔 JSON 與原版完全一致（{version, puzzle, step_count, history:{history_index, snapshots}}）。
 */
const STORAGE_KEY = 'gatennea-slider-web:last';
/** 移植原版 _compact_json_dumps：讓輸出格式與原版一字不差。 */
function compactJsonDumps(data) {
    const indent = 2;
    const maxLineWidth = 200;
    function format(obj, depth, sparse) {
        const currentPad = ' '.repeat(depth * indent);
        const nextPad = ' '.repeat((depth + 1) * indent);
        if (obj === null)
            return 'null';
        if (Array.isArray(obj)) {
            if (obj.length === 0)
                return '[]';
            const allAtomic = obj.every((x) => typeof x === 'number' || typeof x === 'boolean' || x === null);
            if (allAtomic) {
                const inline = '[' + obj.map((x) => JSON.stringify(x)).join(', ') + ']';
                return inline;
            }
            const items = obj.map((x) => format(x, depth + 1, false));
            if (sparse) {
                const sep = ',\n';
                return '[\n' + items.map((it) => nextPad + it).join(sep) + '\n' + currentPad + ']';
            }
            const allSingle = items.every((it) => !it.includes('\n'));
            if (allSingle) {
                const inline = '[' + items.join(', ') + ']';
                if (inline.length <= maxLineWidth)
                    return inline;
            }
            return '[\n' + items.map((it) => nextPad + it).join(',\n') + '\n' + currentPad + ']';
        }
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0)
                return '{}';
            const pairs = keys.map((k) => {
                const v = obj[k];
                const vStr = format(v, depth + 1, k === 'matrix' && Array.isArray(v) && v.length > 0 && Array.isArray(v[0]));
                return [JSON.stringify(k), vStr];
            });
            const allSingle = pairs.every(([, v]) => !v.includes('\n'));
            if (allSingle) {
                const inline = '{' + pairs.map(([k, v]) => k + ': ' + v).join(', ') + '}';
                if (inline.length <= maxLineWidth)
                    return inline;
            }
            return '{\n' + pairs.map(([k, v]) => nextPad + k + ': ' + v).join(',\n') + '\n' + currentPad + '}';
        }
        return JSON.stringify(obj);
    }
    return format(data, 0, false);
}
function puzzleTag(store) {
    return `${store.currentStep}~${store.currentM}*${store.currentN}`;
}
function nowStamp() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const p4 = (n) => String(n).padStart(4, '0');
    return `${p4(d.getFullYear())}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}
/** localStorage 自動快照（對照原版 temp_history.json）。 */
function autosave(store) {
    try {
        localStorage.setItem(STORAGE_KEY, compactJsonDumps(store.serialize()));
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
/** 下載存檔：內容與原版完全一致，檔名也沿用原版 step-m-n-日期時間.json。 */
function downloadSave(store) {
    const p = store.serialize();
    const name = `${store.currentStep}-${store.currentM}-${store.currentN}-${nowStamp()}.json`;
    downloadText(name, compactJsonDumps(p));
}
/** 「另存為」：優先呼叫系統檔案對話框（File System Access API），否則退回下載。 */
async function saveAs(store) {
    const p = store.serialize();
    const name = `${store.currentStep}-${store.currentM}-${store.currentN}-${nowStamp()}.json`;
    const text = compactJsonDumps(p);
    const w = window;
    if (w && typeof w.showSaveFilePicker === 'function') {
        try {
            const handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: 'JSON 存檔', accept: { 'application/json': ['.json'] } }] });
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            return;
        }
        catch (e) {
            // 使用者取消或其他失敗 → 退回下載
        }
    }
    downloadText(name, text);
}
/** 從 JSON 或 map 文本導入。回傳結果文案。 */
function importData(store, text) {
    const t = text.trim();
    if (!t)
        return { ok: false, message: '內容為空' };
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

return { compactJsonDumps, autosave, autoload, downloadSave, saveAs, importData };
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
        /** 右側面板「滑動動畫」開關；關閉時移動瞬間完成 */
        this.animationEnabled = true;
        /** 右側面板「速度」滑條控制的移動動畫時長（ms） */
        this.moveDurationMs = 180;
        this.ui = ui;
        this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true };
        this.attach();
    }
    /** 播放一段過場動畫（undo/redo 用）：從 from 到 to 平滑過渡後停在 to。 */
    playTransition(from, to, durationMs = this.moveDurationMs) {
        const renderer = this.ui.renderer;
        renderer.animation = { start: from, end: to, progress: 0, durationMs };
        const t0 = performance.now();
        const frame = (now) => {
            const anim = renderer.animation;
            if (!anim)
                return;
            const p = Math.min(1, (now - t0) / anim.durationMs);
            anim.progress = p;
            this.ui.requestPaint?.();
            if (p < 1)
                requestAnimationFrame(frame);
            else
                renderer.animation = null;
        };
        requestAnimationFrame(frame);
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
        const movedPositions = selectedList.map((b) => [b.row, b.col]);
        const endBySelected = new Map(selectedList.map((b, i) => [b, finalPositions[i]]));
        const start = store.game.blocks.map((b) => [b.row, b.col]);
        const end = store.game.blocks.map((b) => {
            const e = endBySelected.get(b);
            return e ? [e[0], e[1]] : [b.row, b.col];
        });
        if (!this.animationEnabled) {
            // 關閉動畫：瞬間提交；保留選中以便連續滑動
            store.game.commit_move(finalPositions);
            cmd.stepCount += 1;
            cmd.history.save_snapshot(store.game, {
                direction,
                step: store.currentStep,
                gap_type: cmd.selectedGap?.type,
                gap_line: cmd.selectedGap?.line,
                moved_positions: movedPositions,
            });
            this.notify(`移動 ${direction}`);
            this.ui.onChanged?.();
            this.ui.requestPaint?.();
            return;
        }
        renderer.animation = { start, end, progress: 0, durationMs: this.moveDurationMs };
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
                // 提交（對照 CommandBus.move 的 commit 尾巴；保留選中以便連續滑動）
                store.game.commit_move(finalPositions);
                cmd.stepCount += 1;
                cmd.history.save_snapshot(store.game, {
                    direction,
                    step: store.currentStep,
                    gap_type: cmd.selectedGap?.type,
                    gap_line: cmd.selectedGap?.line,
                    moved_positions: movedPositions,
                });
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
    const movedPositions = ctx.game.blocks
        .filter((b) => ctx.game.selected.has(b))
        .map((b) => [b.row, b.col]);
    ctx.game.commit_move(finalPositions);
    // 對照原版：移動後保留縫隙/滑塊組選中，以便連續滑動
    ctx.stepCount += 1;
    ctx.history.save_snapshot(ctx.game, {
        direction,
        step: ctx.step,
        gap_type: ctx.selectedGap?.type,
        gap_line: ctx.selectedGap?.line,
        moved_positions: movedPositions,
    });
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
    ctx.game.resetTo(m, n);
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
 * 快照式撤銷/重做（對照 history.py::GameHistory + move_info）
 *
 * 每筆快照記錄當下版面與「如何從前一版面到達此版面」的 move_info，
 * 供撤銷/重做只對該步滑塊組做動畫（對照原版 _start_undo_redo_animation）。
 */
const { Block } = require("./Block.js");
class GameHistory {
    constructor() {
        this.entries = [];
        this.index = -1;
    }
    /** 保存當前狀態快照；若不在歷史末尾則截斷。 */
    save_snapshot(game, move_info) {
        const snapshot = {
            blocks: game.blocks.map((b) => [b.row, b.col]),
        };
        if (move_info)
            snapshot.move_info = move_info;
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
    /** 目前快照的 move_info（最後一步如何到達目前版面；undo 用它反向動畫）。 */
    currentMoveInfo() {
        return this.entries[this.index]?.move_info ?? null;
    }
    /** undo 目標（上一筆）快照的 blocks；無可撤銷回 null。 */
    undoTarget() {
        return this.canUndo ? this.entries[this.index - 1] : null;
    }
    /** redo 目標（下一筆）快照的 blocks；無可重做回 null。 */
    redoTarget() {
        return this.canRedo ? this.entries[this.index + 1] : null;
    }
    /** 下一個 redo 目標快照的 move_info。 */
    nextMoveInfo() {
        return this.entries[this.index + 1]?.move_info ?? null;
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
    /** 設定目前歷史索引（載入存檔時用）。 */
    setIndex(index) {
        if (Number.isInteger(index) && index >= 0 && index < this.entries.length)
            this.index = index;
    }
    /** 直接跳到指定歷史步（虛擬鍵盤「跳到某步」用）。 */
    jumpTo(game, index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.entries.length)
            return false;
        this.index = index;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 匯出全部快照（供存檔）。 */
    snapshotAll() {
        return this.entries.map((e) => ({
            blocks: e.blocks.map(([r, c]) => [r, c]),
            ...(e.move_info ? { move_info: e.move_info } : {}),
        }));
    }
    /** 由快照列表還原（index 設為末位，對應載入時停在最新狀態）。 */
    restoreAll(list) {
        this.entries = list.map((e) => ({
            blocks: e.blocks.map(([r, c]) => [r, c]),
            ...(e.move_info ? { move_info: e.move_info } : {}),
        }));
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
    "m8": function (require) {
/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * 存檔格式與原版完全一致：{version, puzzle, step_count, history:{history_index, snapshots:[{matrix,bounds,move_info?}]}}
 */
const { createContext } = require("../core/CommandBus.js");
const { SliderMatrix } = require("../core/SliderMatrix.js");
function matrixToBlocks(matrix, bounds) {
    if (!Array.isArray(matrix) || !bounds || !Number.isInteger(bounds.min_row) || !Number.isInteger(bounds.min_col))
        return null;
    const out = [];
    for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row))
            return null;
        for (let c = 0; c < row.length; c++) {
            if (row[c] === 1)
                out.push([bounds.min_row + r, bounds.min_col + c]);
        }
    }
    return out;
}
function blocksToMatrix(blocks) {
    if (blocks.length === 0) {
        return { matrix: [], bounds: { min_row: 0, max_row: 0, min_col: 0, max_col: 0 } };
    }
    const rows = blocks.map((b) => b[0]);
    const cols = blocks.map((b) => b[1]);
    const min_row = Math.min(...rows);
    const max_row = Math.max(...rows);
    const min_col = Math.min(...cols);
    const max_col = Math.max(...cols);
    const set = new Set(blocks.map((b) => `${b[0]}:${b[1]}`));
    const matrix = [];
    for (let r = min_row; r <= max_row; r++) {
        const row = [];
        for (let c = min_col; c <= max_col; c++) {
            row.push(set.has(`${r}:${c}`) ? 1 : 0);
        }
        matrix.push(row);
    }
    return { matrix, bounds: { min_row, max_row, min_col, max_col } };
}
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
    /** 序列化為與原版完全一致的結構。 */
    serialize() {
        const entries = this.cmd.history.snapshotAll();
        const snapshots = entries.map((e) => {
            const { matrix, bounds } = blocksToMatrix(e.blocks);
            const snap = { matrix, bounds };
            if (e.move_info)
                snap.move_info = e.move_info;
            return snap;
        });
        return {
            version: 1,
            puzzle: { m: this.currentM, n: this.currentN, step: this.currentStep },
            step_count: this.cmd.stepCount,
            history: {
                history_index: this.cmd.history.currentIndex,
                snapshots,
            },
        };
    }
    /** 由序列化結構還原（相容原版 save JSON；也相容舊版網頁格式）。 */
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
        // 將各格式歷史轉為 HistoryEntry（blocks + move_info?）
        const entries = [];
        if (Array.isArray(p.history)) {
            // 舊版網頁格式：history 是 blocks 陣列
            for (const h of p.history) {
                if (Array.isArray(h?.blocks))
                    entries.push({ blocks: h.blocks, ...(h.move_info ? { move_info: h.move_info } : {}) });
            }
        }
        else if (p.history && Array.isArray(p.history.snapshots)) {
            // 原版格式：matrix + bounds + move_info?
            for (const snap of p.history.snapshots) {
                const blocks = matrixToBlocks(snap?.matrix, snap?.bounds);
                if (blocks)
                    entries.push({ blocks, ...(snap?.move_info ? { move_info: snap.move_info } : {}) });
            }
        }
        if (entries.length > 0) {
            this.game.restore({ blocks: entries[entries.length - 1].blocks });
        }
        this.cmd = createContext(this.game, step);
        this.cmd.stepCount = p.step_count ?? 0;
        if (entries.length > 0) {
            this.cmd.history.restoreAll(entries);
            const idx = p.history && typeof p.history === 'object' && 'history_index' in p.history
                ? p.history.history_index
                : entries.length - 1;
            this.cmd.history.setIndex(idx);
        }
        return true;
    }
}

return { GameStore };
},
    "m9": function (require) {
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
    /** 原地重設為 m×n 實心矩形（reset 用，避免外部 store 持有舊引用）。 */
    resetTo(m, n) {
        this.m = m;
        this.n = n;
        this.blocks = [];
        this.selected.clear();
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                this.blocks.push(new Block([i, j]));
            }
        }
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
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/rules.js": "m7",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/store/GameStore.js": "m8",
    "E:/program_project/py/貓九的滑塊遊戲/web/dist/core/SliderMatrix.js": "m9" };
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
